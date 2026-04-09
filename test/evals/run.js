const fs = require('fs')
const path = require('path')
const { createEvalAgent } = require('./agent-factory')
const { runChecks } = require('./checker')
const { applyScenario } = require('./scenarios')
const { startFakeServer } = require('../helpers/fake-api-server')
const { createIntegrationHarness, teardownIntegrationHarness } = require('../helpers/integration-runner')

/**
 * Main evaluation runner.
 */
async function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose') || args.includes('-v')
  const noJudge = args.includes('--no-judge')
  const dryRun = args.includes('--dry-run')
  const numRuns = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] || '1', 10)
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5', 10)

  const apiKey = process.env.GOOGLE_API_KEY
  const baseUrl = process.env.GOOGLE_BASE_URL

  if (!apiKey && !dryRun) {
    console.error('Error: GOOGLE_API_KEY environment variable is required.')
    process.exit(1)
  }

  const globalConfigPath = path.join(__dirname, 'config.json')
  const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'))

  const casesDir = path.join(__dirname, 'cases')
  const caseFiles = fs.readdirSync(casesDir, { recursive: true })
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(casesDir, f))

  const evalCases = caseFiles.map(parseEvalFile)

  console.log(`\n🚀 Starting Evaluations (${evalCases.length} cases, ${numRuns} runs each, concurrency=${concurrency})\n`)

  const start = Date.now()
  const results = []

  let judgeFn = null
  if (!noJudge && !dryRun) {
    const { createJudge } = require('./judge')
    judgeFn = await createJudge({ apiKey })
  }

  /**
   * Runs a single evaluation case.
   * @param {Object} evalCase
   * @param {number} _index
   */
  async function runSingleEval(evalCase, _index) {
    let localFakeServer = null
    let localHarness = null
    const backend = process.env.CEP_BACKEND || 'fake'

    if (backend === 'fake') {
      localFakeServer = await startFakeServer()
    }

    try {
      const harnessOptions = {}
      if (localFakeServer) {
        harnessOptions.rootUrl = localFakeServer.url
      }
      localHarness = await createIntegrationHarness(harnessOptions)
      const agent = await createEvalAgent({ apiKey, baseUrl: baseUrl || undefined, mcpClient: localHarness.client })

      const allResults = []

      for (let run = 0; run < numRuns; run++) {
        const runStart = Date.now()
        if (localFakeServer) {
          localFakeServer.resetState()
          if (evalCase.fixtures) {
            for (const fixtureFile of evalCase.fixtures) {
              const fixturePath = path.resolve(__dirname, 'fixtures', fixtureFile)
              const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
              localFakeServer.mergeFixture(fixtureData)
            }
          }
          if (evalCase.scenario) {
            localFakeServer.setState(applyScenario(evalCase.scenario))
          }
        }

        // Resolve prompt: MCP prompt definition or inline from eval markdown
        let promptText = evalCase.prompt
        if (evalCase.promptName) {
          const mcpPrompt = await localHarness.client.getPrompt({ name: evalCase.promptName })
          promptText = mcpPrompt.messages[0].content.text
        }

        let responseText = ''
        let toolCalls = []

        try {
          const result = await agent.query(promptText)
          responseText = result.responseText
          toolCalls = result.toolCalls
        } catch (err) {
          responseText = `Agent error: ${err.message}`
        }

        const actualToolNames = toolCalls.map(tc => tc.name)
        const deterministic = runChecks(responseText, actualToolNames, evalCase)

        let judgeResult
        if (judgeFn) {
          const rubric = evalCase.judgeInstructions || globalConfig.defaultJudgeRubric
          judgeResult = await judgeFn({ responseText, goldenResponse: evalCase.goldenResponse, rubric })
        } else {
          judgeResult = { passed: true, reasoning: 'skipped (--no-judge)' }
        }

        const passed = deterministic.passed && judgeResult.passed

        const result = {
          id: evalCase.id,
          category: evalCase.category,
          prompt: evalCase.prompt,
          passed,
          deterministic,
          judge: judgeResult,
          toolCalls,
          responseText,
          durationMs: Date.now() - runStart,
          runIndex: run + 1,
        }

        allResults.push(result)

        // Live output as each run completes
        const r = result
        const G = '\x1b[32m'
        const R = '\x1b[31m'
        const D = '\x1b[2m'
        const RST = '\x1b[0m'
        const status = r.passed ? `${G}PASS${RST}` : `${R}FAIL${RST}`
        const title = r.prompt.length > 50 ? r.prompt.slice(0, 47) + '...' : r.prompt
        const sec = `${D}${(r.durationMs / 1000).toFixed(1)}s${RST}`
        const runStr = numRuns > 1 ? ` [Run ${run + 1}/${numRuns}]` : ''
        console.log(`  ${r.id.padEnd(5)} ${status}  ${(title + runStr).padEnd(52)} ${sec}`)
        if (!r.passed && r.deterministic.failures.length > 0) {
          for (const f of r.deterministic.failures) {
            console.log(`  ${' '.repeat(5)}       ${R}${f}${RST}`)
          }
        }
        if (
          r.judge.reasoning &&
          r.judge.reasoning !== 'skipped (--no-judge)' &&
          r.judge.reasoning !== 'skipped (dry run)'
        ) {
          console.log(`  ${' '.repeat(5)}       ${D}Judge: ${r.judge.reasoning}${RST}`)
        }
        if (verbose && r.toolCalls.length > 0) {
          console.log(`  ${' '.repeat(5)}       ${D}Tools: ${r.toolCalls.map(tc => tc.name).join(', ')}${RST}`)
        }
      }

      return allResults
    } finally {
      if (localHarness) {
        await teardownIntegrationHarness(localHarness, [])
      }
      if (localFakeServer) {
        await localFakeServer.close()
      }
    }
  }

  // Run evals with bounded concurrency
  const PQueue = (await import('p-queue')).default
  const queue = new PQueue({ concurrency })

  const runPromises = evalCases.map(evalCase => queue.add(() => runSingleEval(evalCase)))
  const nestedResults = await Promise.all(runPromises)
  results.push(...nestedResults.flat())

  const totalTime = Date.now() - start
  const passedCount = results.filter(r => r.passed).length
  const passRate = ((passedCount / results.length) * 100).toFixed(1)

  console.log(`\n📊 Done! Pass rate: ${passRate}% (${passedCount}/${results.length}) in ${(totalTime / 1000).toFixed(1)}s\n`)

  const summary = {
    stats: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      passRate: parseFloat(passRate),
      durationMs: totalTime,
    },
    results,
  }

  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(summary, null, 2))
}

/**
 * Parses an evaluation markdown file.
 * @param {string} filePath
 * @returns {Object}
 */
function parseEvalFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const id = path.basename(filePath, '.md')
  const category = path.dirname(filePath).split(path.sep).pop()

  const evalCase = { id, category }

  let currentSection = null
  for (let line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).toLowerCase().trim()
      continue
    }

    if (!currentSection) continue

    if (currentSection === 'prompt') {
      if (line.startsWith('prompt: ')) {
        evalCase.promptName = line.slice(8).trim()
      } else if (!evalCase.promptName) {
        evalCase.prompt = (evalCase.prompt || '') + line + '\n'
      }
    } else if (currentSection === 'expected output') {
      if (line.startsWith('- tool: ')) {
        evalCase.expectedTools = evalCase.expectedTools || []
        evalCase.expectedTools.push(line.slice(8).trim())
      } else if (line.startsWith('- matches: ')) {
        evalCase.expectedMatches = evalCase.expectedMatches || []
        evalCase.expectedMatches.push(line.slice(11).trim())
      } else if (line.startsWith('- not_matches: ')) {
        evalCase.expectedNotMatches = evalCase.expectedNotMatches || []
        evalCase.expectedNotMatches.push(line.slice(15).trim())
      }
    } else if (currentSection === 'judge instructions') {
      evalCase.judgeInstructions = (evalCase.judgeInstructions || '') + line + '\n'
    } else if (currentSection === 'context') {
      if (line.startsWith('- scenario: ')) {
        evalCase.scenario = line.slice(12).trim()
      } else if (line.startsWith('- fixture: ')) {
        evalCase.fixtures = evalCase.fixtures || []
        evalCase.fixtures.push(line.slice(11).trim())
      }
    }
  }

  if (evalCase.prompt) evalCase.prompt = evalCase.prompt.trim()
  if (evalCase.judgeInstructions) evalCase.judgeInstructions = evalCase.judgeInstructions.trim()

  return evalCase
}

main().catch(console.error)
