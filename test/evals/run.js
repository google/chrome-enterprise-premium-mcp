/* eslint-disable n/no-process-exit */
/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @fileoverview CEP MCP Eval runner. Single CLI entry point.
 *
 * Usage:
 *   node test/evals/run.js [options]
 *
 * Options:
 *   --category <name>   Run only evals in this category (comma-separated)
 *   --tags <t1,t2>      Run only evals matching these tags
 *   --id <id1,id2>      Run specific eval IDs
 *   --runs <n>          Number of judge runs per eval (default: 1)
 *   --output <path>     Write JSON results to file
 *   --concurrency <n>   Parallel eval workers (default: 5)
 *   --verbose           Show full agent responses in console
 *   --no-judge          Skip LLM judge, only run deterministic checks
 *   --dry-run           Validate eval config: run deterministic checks against golden responses
 *
 * Environment:
 *   GEMINI_API_KEY      Required (unless --dry-run). Gemini API key for agent + judge.
 *   CEP_BACKEND         "fake" (default) or "real".
 */

import { parseArgs } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadAllEvals, loadGlobalConfig } from './lib/loader.js'
import { runChecks } from './lib/assertions.js'
import { createJudge } from './lib/judge.js'
import { createEvalAgent } from './lib/agent.js'
import { printConsole, writeResults } from './lib/reporter.js'
import { startFakeServer } from '../helpers/fake-api-server.js'
import { createIntegrationHarness, teardownIntegrationHarness } from '../helpers/integration/tools/harness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** CLI argument parsing */

const { values: args } = parseArgs({
  options: {
    category: { type: 'string' },
    tags: { type: 'string' },
    id: { type: 'string' },
    runs: { type: 'string', default: '1' },
    output: { type: 'string' },
    concurrency: { type: 'string', default: '5' },
    verbose: { type: 'boolean', default: false },
    'no-judge': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  allowPositionals: false,
})

if (args.help) {
  console.log(`Usage: node test/evals/run.js [options]

Options:
  --category <name>   Run only evals in this category (comma-separated)
  --tags <t1,t2>      Run only evals matching these tags
  --id <id1,id2>      Run specific eval IDs
  --runs <n>          Number of judge runs per eval (default: 1)
  --output <path>     Write JSON results to file
  --concurrency <n>   Parallel eval workers (default: 5)
  --verbose           Show full agent responses in console
  --no-judge          Skip LLM judge, only run deterministic checks
  --dry-run           Validate config: check golden responses against patterns (no Gemini needed)

Environment:
  GEMINI_API_KEY      Required (unless --dry-run). Gemini API key for agent + judge.
  CEP_BACKEND         "fake" (default) or "real".`)
  process.exit(0)
}

/** Main */
async function main() {
  const dryRun = args['dry-run']
  const noJudge = args['no-judge']
  const verbose = args.verbose

  const evalsDir = path.resolve(__dirname)
  const category = args.category || process.env.EVAL_CATEGORY
  const tags = (args.tags || process.env.EVAL_TAGS)?.split(',').map(t => t.trim())
  const ids = (args.id || process.env.EVAL_IDS)?.split(',').map(t => t.trim())
  const numRuns = parseInt(args.runs, 10) || 1
  const concurrency = parseInt(args.concurrency, 10) || 5

  // Load evals
  const evals = loadAllEvals({ dir: evalsDir, category, tags, ids })
  if (evals.length === 0) {
    console.error('No evals matched the given filters.')
    process.exit(1)
  }
  const globalConfig = loadGlobalConfig(evalsDir)

  // Dry run: validate eval config by checking golden responses against patterns
  if (dryRun) {
    console.log(`Dry run: validating ${evals.length} eval(s) against their golden responses...\n`)
    const results = evals.map(evalCase => {
      const deterministic = runChecks(evalCase.goldenResponse, evalCase.expectedTools, evalCase)
      return {
        id: evalCase.id,
        category: evalCase.category,
        prompt: evalCase.prompt,
        passed: deterministic.passed,
        deterministic,
        judge: { passed: true, reasoning: 'skipped (dry run)' },
        toolCalls: evalCase.expectedTools.map(name => ({ name, args: {} })),
        responseText: evalCase.goldenResponse,
        durationMs: 0,
      }
    })
    printConsole(results, { verbose })
    if (args.output) {
      writeResults(results, args.output)
    }
    const allPassed = results.every(r => r.passed)
    process.exit(allPassed ? 0 : 1)
  }

  // Full run: requires Gemini API key
  const apiKey = process.env.GEMINI_API_KEY
  const baseUrl = process.env.GOOGLE_GEMINI_BASE_URL

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is required.')
    if (baseUrl || (process.env.USER && process.env.USER.endsWith('.goog'))) {
      console.error(
        'Internal users: Set "api_proxy:shared-g3-gemini-quota" and ensure GOOGLE_GEMINI_BASE_URL points to the proxy.',
      )
    }
    console.error('Use --dry-run to validate eval configuration without an API key.')
    process.exit(1)
  }

  // Start fake API server if using fake backend
  let fakeServer = null
  const backend = process.env.CEP_BACKEND || 'fake'
  if (backend === 'fake') {
    fakeServer = await startFakeServer()
    process.env.GOOGLE_API_ROOT_URL = fakeServer.url
    process.env.CEP_BACKEND = 'fake'
    console.log(`Fake API server started at ${fakeServer.url}`)
  }

  // Initialize MCP harness + agent
  let harness
  try {
    harness = await createIntegrationHarness()
  } catch (err) {
    console.error(`Failed to initialize MCP harness: ${err.message}`)
    if (fakeServer) {
      await fakeServer.close()
    }
    process.exit(1)
  }

  const judgeFn = noJudge ? null : createJudge(apiKey, baseUrl || undefined).judge
  const agent = await createEvalAgent({ apiKey, baseUrl: baseUrl || undefined, mcpClient: harness.client })

  // Most evals are read-only so shared fake-server state is safe at higher
  // concurrency. Mutation evals (m01-m03) may interact if they run simultaneously.
  // We force concurrency=1 for fake backend to avoid race conditions on resets.
  const effectiveConcurrency = Math.min(backend === 'fake' ? 1 : concurrency, evals.length)
  const mode = noJudge ? 'deterministic only' : 'full (agent + judge)'
  console.log(`Running ${evals.length} eval(s) [${mode}] concurrency=${effectiveConcurrency}, runs=${numRuns}...\n`)

  /**
   * @param {import('./lib/loader.js').EvalCase} evalCase
   * @param {number} index
   */
  async function runSingleEval(evalCase, index) {
    const start = Date.now()
    let bestResult = null

    for (let run = 0; run < numRuns; run++) {
      if (fakeServer) {
        fakeServer.resetState()
      }

      let responseText = ''
      let toolCalls = []

      try {
        const result = await agent.query(evalCase.prompt)
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
        durationMs: Date.now() - start,
      }

      if (!bestResult || !passed) {
        bestResult = result
      }
    }

    // Live output as each eval completes
    const r = bestResult
    const G = '\x1b[32m'
    const R = '\x1b[31m'
    const D = '\x1b[2m'
    const RST = '\x1b[0m'
    const status = r.passed ? `${G}PASS${RST}` : `${R}FAIL${RST}`
    const title = r.prompt.length > 50 ? r.prompt.slice(0, 47) + '...' : r.prompt
    const sec = `${D}${(r.durationMs / 1000).toFixed(1)}s${RST}`
    console.log(`  ${r.id.padEnd(5)} ${status}  ${title.padEnd(52)} ${sec}`)
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

    return bestResult
  }

  // Run evals with bounded concurrency
  const results = []
  const queue = evals.map((e, i) => ({ evalCase: e, index: i + 1 }))

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) {
        break
      }
      const result = await runSingleEval(item.evalCase, item.index)
      results.push(result)
    }
  }

  const workers = Array.from({ length: effectiveConcurrency }, () => worker())
  await Promise.all(workers)

  console.log()

  // Sort results by ID for consistent output
  results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  // Output — auto-enable verbose if there are failures
  const hasFailures = results.some(r => !r.passed)
  printConsole(results, { verbose: verbose || hasFailures })

  if (args.output) {
    writeResults(results, args.output)
  }

  // Cleanup
  await teardownIntegrationHarness(harness, [])
  if (fakeServer) {
    await fakeServer.close()
  }

  process.exit(hasFailures ? 1 : 0)
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`)
  process.exit(1)
})
