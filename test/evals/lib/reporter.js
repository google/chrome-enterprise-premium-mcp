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
 * @fileoverview Console and JSON output for eval results.
 */

import fs from 'node:fs'
import path from 'node:path'

// ANSI color helpers (no dependency needed)
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

/**
 * Prints a summary table to the console.
 *
 * @param {EvalResult[]} results
 * @param {{ verbose: boolean }} options
 */
export function printConsole(results, { verbose = false } = {}) {
  const line = '═'.repeat(60)
  console.log(`\n${BOLD}CEP MCP Evals${RESET}`)
  console.log(line)
  console.log()

  // Group by ID
  const byId = {}
  for (const r of results) {
    if (!byId[r.id]) {
      byId[r.id] = { id: r.id, category: r.category, prompt: r.prompt, runs: [] }
    }
    byId[r.id].runs.push(r)
  }

  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const passed = e.runs.filter(r => r.passed).length
    const total = e.runs.length
    const isStable = passed === total

    // Status depends on stability: if all passed, it's green. If some passed, yellow? We use green/red based on 100% pass rate.
    const status = isStable ? `${GREEN}PASS (${passed}/${total})${RESET}` : `${RED}FAIL (${passed}/${total})${RESET}`
    const title = e.prompt.length > 50 ? e.prompt.slice(0, 47) + '...' : e.prompt

    // Average duration
    const avgDurationMs = e.runs.reduce((sum, r) => sum + r.durationMs, 0) / total
    const duration = `${DIM}${(avgDurationMs / 1000).toFixed(1)}s/run${RESET}`
    console.log(`  ${e.id.padEnd(5)} ${status.padEnd(30)}  ${title.padEnd(52)} ${duration}`)

    if (!isStable) {
      // Print failures for the first failed run to avoid spam
      const failedRuns = e.runs.filter(r => !r.passed)
      if (failedRuns.length > 0) {
        const firstFail = failedRuns[0]
        console.log(`  ${' '.repeat(5)}       ${DIM}(Showing first failure, Run ${firstFail.runIndex})${RESET}`)
        const reasons = [
          ...firstFail.deterministic.failures,
          ...(firstFail.judge.passed ? [] : [`Judge: ${firstFail.judge.reasoning}`]),
        ]
        for (const reason of reasons) {
          console.log(`  ${' '.repeat(5)}       ${RED}${reason}${RESET}`)
        }

        if (verbose) {
          if (firstFail.toolCalls?.length > 0) {
            console.log(
              `  ${' '.repeat(5)}       ${DIM}Tools: ${firstFail.toolCalls.map(tc => tc.name).join(', ')}${RESET}`,
            )
          }
          if (firstFail.responseText) {
            const preview = firstFail.responseText.split('\n').slice(0, 5).join('\n')
            console.log(`  ${' '.repeat(5)}       ${DIM}Response:${RESET}`)
            for (const ln of preview.split('\n')) {
              console.log(`  ${' '.repeat(5)}       ${DIM}  ${ln}${RESET}`)
            }
            if (firstFail.responseText.split('\n').length > 5) {
              console.log(
                `  ${' '.repeat(5)}       ${DIM}  ... (${firstFail.responseText.split('\n').length} lines total)${RESET}`,
              )
            }
          }
        }
      }
    }
  }

  // Category breakdown
  console.log()
  const { totalRuns, passedRuns, pct } = getSummaryStats(results)
  const color = passedRuns === totalRuns ? GREEN : RED
  console.log(`${BOLD}Results: ${color}${passedRuns}/${totalRuns} runs passed (${pct}%)${RESET}`)

  const categories = [...new Set(results.map(r => r.category))].sort()
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catPassed = catResults.filter(r => r.passed).length
    const catPct = ((catPassed / catResults.length) * 100).toFixed(1)
    const catColor = catPassed === catResults.length ? GREEN : RED
    console.log(`  ${cat.padEnd(20)} ${catColor}${catPassed}/${catResults.length} (${catPct}%)${RESET}`)
  }
  console.log()
}

/**
 * Writes results to a file. Chooses format based on file extension:
 * .md -> Markdown, .json -> JSON.
 *
 * @param {EvalResult[]} results
 * @param {string} filepath
 */
export function writeResults(results, filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })

  if (filepath.endsWith('.md')) {
    writeMarkdown(results, filepath)
  } else {
    writeJson(results, filepath)
  }
  console.log(`Results written to ${filepath}`)
}

/**
 * Calculates basic summary statistics from evaluation results.
 * @param {EvalResult[]} results
 * @returns {{ totalRuns: number, passedRuns: number, pct: string }}
 */
function getSummaryStats(results) {
  const totalRuns = results.length
  const passedRuns = results.filter(r => r.passed).length
  const pct = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '0.0'
  return { totalRuns, passedRuns, pct }
}

/**
 * Writes a Markdown report.
 *
 * @param {EvalResult[]} results
 * @param {string} filepath
 */
function writeMarkdown(results, filepath) {
  const { totalRuns, passedRuns, pct } = getSummaryStats(results)

  const lines = []
  lines.push(`# CEP MCP Eval Results`)
  lines.push('')
  lines.push(`**Date:** ${new Date().toISOString()}`)
  lines.push(
    `**Total Runs:** ${totalRuns} | **Passed Runs:** ${passedRuns} | **Failed Runs:** ${totalRuns - passedRuns} | **Pass Rate:** ${pct}%`,
  )
  lines.push('')

  // Category table
  const categories = [...new Set(results.map(r => r.category))].sort()
  lines.push(`## Results by Category`)
  lines.push('')
  lines.push(`| Category | Passed Runs | Total Runs | Rate |`)
  lines.push(`|----------|-------------|------------|------|`)
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catPassed = catResults.filter(r => r.passed).length
    const catPct = ((catPassed / catResults.length) * 100).toFixed(1)
    lines.push(`| ${cat} | ${catPassed} | ${catResults.length} | ${catPct}% |`)
  }
  lines.push('')

  // Detailed results
  lines.push(`## Stability by Eval Case`)
  lines.push('')

  // Group by ID
  const byId = {}
  for (const r of results) {
    if (!byId[r.id]) {
      byId[r.id] = {
        id: r.id,
        category: r.category,
        prompt: r.prompt,
        totalRuns: 0,
        passedRuns: 0,
        runs: [],
      }
    }
    byId[r.id].totalRuns++
    if (r.passed) {
      byId[r.id].passedRuns++
    }
    byId[r.id].runs.push(r)
  }

  lines.push(`| ID | Category | Pass Rate | Passed / Total |`)
  lines.push(`|----|----------|-----------|----------------|`)
  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const rate = ((e.passedRuns / e.totalRuns) * 100).toFixed(1)
    lines.push(`| **${id}** | ${e.category} | ${rate}% | ${e.passedRuns} / ${e.totalRuns} |`)
  }
  lines.push('')

  lines.push(`## Detailed Run Failures`)
  lines.push('')

  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const failedRuns = e.runs.filter(r => !r.passed)
    if (failedRuns.length > 0) {
      lines.push(`### ${id} — ${e.passedRuns}/${e.totalRuns} Passed`)
      lines.push(`**Prompt:** ${e.prompt}`)
      lines.push('')
      for (const r of failedRuns) {
        lines.push(`#### Run ${r.runIndex || '?'}`)
        if (r.toolCalls?.length > 0) {
          lines.push(`**Tools:** ${r.toolCalls.map(tc => tc.name).join(', ')}`)
        }
        if (r.deterministic.failures.length > 0) {
          lines.push(`**Failures:**`)
          for (const f of r.deterministic.failures) {
            lines.push(`- ${f}`)
          }
        }
        if (
          r.judge?.reasoning &&
          r.judge.reasoning !== 'skipped (--no-judge)' &&
          r.judge.reasoning !== 'skipped (dry run)'
        ) {
          lines.push(`**Judge:** ${r.judge.reasoning}`)
        }
        if (r.responseText) {
          const preview = r.responseText.split('\n').slice(0, 10).join('\n')
          lines.push('')
          lines.push(`<details><summary>Response preview</summary>`)
          lines.push('')
          lines.push('```')
          lines.push(preview)
          if (r.responseText.split('\n').length > 10) {
            lines.push(`... (${r.responseText.split('\n').length} lines total)`)
          }
          lines.push('```')
          lines.push('')
          lines.push(`</details>`)
        }
        lines.push('')
      }
      lines.push('---')
      lines.push('')
    }
  }

  fs.writeFileSync(filepath, lines.join('\n'))
}

/**
 * Writes structured JSON results to a file.
 *
 * @param {EvalResult[]} results
 * @param {string} filepath
 */
function writeJson(results, filepath) {
  const totalRuns = results.length
  const passedRuns = results.filter(r => r.passed).length

  // Category breakdown
  const byCategory = {}
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { total: 0, passed: 0 }
    }
    byCategory[r.category].total++
    if (r.passed) {
      byCategory[r.category].passed++
    }
  }

  // Group by ID
  const byId = {}
  for (const r of results) {
    if (!byId[r.id]) {
      byId[r.id] = {
        id: r.id,
        category: r.category,
        prompt: r.prompt,
        totalRuns: 0,
        passedRuns: 0,
        runs: [],
      }
    }
    byId[r.id].totalRuns++
    if (r.passed) {
      byId[r.id].passedRuns++
    }
    byId[r.id].runs.push({
      passed: r.passed,
      deterministic: r.deterministic,
      judge: r.judge,
      toolsCalled: r.toolCalls?.map(tc => tc.name) || [],
      responseText: r.responseText,
      durationMs: r.durationMs,
      runIndex: r.runIndex,
    })
  }

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRuns,
      passedRuns,
      failedRuns: totalRuns - passedRuns,
      passRate: totalRuns > 0 ? parseFloat(((passedRuns / totalRuns) * 100).toFixed(1)) : 0,
    },
    byCategory,
    evaluations: Object.values(byId).map(e => ({
      id: e.id,
      category: e.category,
      prompt: e.prompt,
      totalRuns: e.totalRuns,
      passedRuns: e.passedRuns,
      passRate: e.totalRuns > 0 ? parseFloat(((e.passedRuns / e.totalRuns) * 100).toFixed(1)) : 0,
      isStable: e.passedRuns === e.totalRuns,
      runs: e.runs,
    })),
  }

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2) + '\n')
}

/**
 * @typedef {object} EvalResult
 * @property {string} id
 * @property {string} category
 * @property {string} prompt
 * @property {boolean} passed
 * @property {{ passed: boolean, failures: string[] }} deterministic
 * @property {{ passed: boolean, reasoning: string }} judge
 * @property {{ name: string, args: object }[]} toolCalls
 * @property {string} responseText
 * @property {number} durationMs
 * @property {number} runIndex
 */
