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

  for (const r of results) {
    const status = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`
    const title = r.prompt.length > 50 ? r.prompt.slice(0, 47) + '...' : r.prompt
    const duration = `${DIM}${(r.durationMs / 1000).toFixed(1)}s${RESET}`
    console.log(`  ${r.id.padEnd(5)} ${status}  ${title.padEnd(52)} ${duration}`)

    if (!r.passed) {
      const reasons = [...r.deterministic.failures, ...(r.judge.passed ? [] : [`Judge: ${r.judge.reasoning}`])]
      for (const reason of reasons) {
        console.log(`  ${' '.repeat(5)}       ${RED}${reason}${RESET}`)
      }
    }

    if (verbose) {
      if (
        r.judge?.reasoning &&
        r.judge.reasoning !== 'skipped (--no-judge)' &&
        r.judge.reasoning !== 'skipped (dry run)'
      ) {
        console.log(`  ${' '.repeat(5)}       ${DIM}Judge: ${r.judge.reasoning}${RESET}`)
      }
      if (r.toolCalls?.length > 0) {
        console.log(`  ${' '.repeat(5)}       ${DIM}Tools: ${r.toolCalls.map(tc => tc.name).join(', ')}${RESET}`)
      }
      if (r.responseText) {
        const preview = r.responseText.split('\n').slice(0, 5).join('\n')
        console.log(`  ${' '.repeat(5)}       ${DIM}Response:${RESET}`)
        for (const ln of preview.split('\n')) {
          console.log(`  ${' '.repeat(5)}       ${DIM}  ${ln}${RESET}`)
        }
        if (r.responseText.split('\n').length > 5) {
          console.log(`  ${' '.repeat(5)}       ${DIM}  ... (${r.responseText.split('\n').length} lines total)${RESET}`)
        }
      }
      console.log()
    }
  }

  // Category breakdown
  console.log()
  const total = results.length
  const passed = results.filter(r => r.passed).length
  const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0'
  const color = passed === total ? GREEN : RED
  console.log(`${BOLD}Results: ${color}${passed}/${total} passed (${pct}%)${RESET}`)

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
 * Writes a Markdown report.
 *
 * @param {EvalResult[]} results
 * @param {string} filepath
 */
function writeMarkdown(results, filepath) {
  const total = results.length
  const passed = results.filter(r => r.passed).length
  const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0'

  const lines = []
  lines.push(`# CEP MCP Eval Results`)
  lines.push('')
  lines.push(`**Date:** ${new Date().toISOString()}`)
  lines.push(`**Total:** ${total} | **Passed:** ${passed} | **Failed:** ${total - passed} | **Pass Rate:** ${pct}%`)
  lines.push('')

  // Category table
  const categories = [...new Set(results.map(r => r.category))].sort()
  lines.push(`## Results by Category`)
  lines.push('')
  lines.push(`| Category | Passed | Total | Rate |`)
  lines.push(`|----------|--------|-------|------|`)
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catPassed = catResults.filter(r => r.passed).length
    const catPct = ((catPassed / catResults.length) * 100).toFixed(1)
    lines.push(`| ${cat} | ${catPassed} | ${catResults.length} | ${catPct}% |`)
  }
  lines.push('')

  // Detailed results
  lines.push(`## Detailed Results`)
  lines.push('')
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL'
    lines.push(`### ${r.id} — ${status}`)
    lines.push('')
    lines.push(`**Prompt:** ${r.prompt}`)
    lines.push(`**Duration:** ${(r.durationMs / 1000).toFixed(1)}s`)
    if (r.toolCalls?.length > 0) {
      lines.push(`**Tools:** ${r.toolCalls.map(tc => tc.name).join(', ')}`)
    }
    if (!r.passed && r.deterministic.failures.length > 0) {
      lines.push('')
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
    if (r.responseText && !r.passed) {
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
    lines.push('---')
    lines.push('')
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
  const total = results.length
  const passed = results.filter(r => r.passed).length

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

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0,
    },
    byCategory,
    results: results.map(r => ({
      id: r.id,
      category: r.category,
      prompt: r.prompt,
      passed: r.passed,
      deterministic: r.deterministic,
      judge: r.judge,
      toolsCalled: r.toolCalls.map(tc => tc.name),
      responseText: r.responseText,
      durationMs: r.durationMs,
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
 */
