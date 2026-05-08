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
 * @file Console and JSON output for eval results.
 */

import fs from 'node:fs'
import path from 'node:path'
import { Status } from './transient.js'

const ANSI = Object.freeze({
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
})

const TITLE_MAX = 50
const TITLE_TRUNCATE_AT = 47
const RESPONSE_PREVIEW_LINES = { console: 5, markdown: 10 }

/**
 * @typedef {object} EvalResult
 * @property {string} id
 * @property {string} category
 * @property {string} prompt
 * @property {boolean} passed
 * @property {string} status                       PASS | FAIL | TRANSIENT
 * @property {{ source: string, message: string } | null} transient
 * @property {{ passed: boolean, failures: string[], skipped?: boolean }} deterministic
 * @property {{ passed: boolean, reasoning: string, skipped?: boolean }} judge
 * @property {{ name: string, args: object }[]} toolCalls
 * @property {string} responseText
 * @property {number} durationMs
 * @property {number} runIndex
 */

/**
 * @typedef {object} ReportOptions
 * @property {boolean} [verbose]
 * @property {boolean} [inconclusive]   Set when transient share exceeds the runner's ceiling.
 */

/**
 * Counts results by status. Used for both summaries and per-case stability.
 * @param {EvalResult[]} results
 * @returns {{ passed: number, failed: number, transient: number, total: number, passRate: number }}
 *   passRate is PASS / (PASS + FAIL); transients are excluded from the denominator.
 */
function countByStatus(results) {
  let passed = 0
  let failed = 0
  let transient = 0
  for (const r of results) {
    if (r.status === Status.PASS) {
      passed++
    } else if (r.status === Status.TRANSIENT) {
      transient++
    } else {
      failed++
    }
  }
  const decisive = passed + failed
  const passRate = decisive > 0 ? passed / decisive : 0
  return { passed, failed, transient, total: results.length, passRate }
}

function truncate(text, max = TITLE_MAX, ellipsis = TITLE_TRUNCATE_AT) {
  return text.length > max ? text.slice(0, ellipsis) + '...' : text
}

/**
 * Renders a per-case outcome in plain English (e.g. "3 of 5 runs passed,
 * 2 failed, 1 transient error"). Drops zero-count categories.
 * @param {{ passed: number, failed: number, transient: number, total: number }} c
 * @returns {string}
 */
function formatOutcome(c) {
  const parts = [`${c.passed} of ${c.total} runs passed`]
  if (c.failed > 0) {
    parts.push(`${c.failed} failed`)
  }
  if (c.transient > 0) {
    parts.push(`${c.transient} transient error${c.transient === 1 ? '' : 's'}`)
  }
  return parts.join(', ')
}

function statusColor(status) {
  if (status === Status.PASS) {
    return ANSI.green
  }
  if (status === Status.TRANSIENT) {
    return ANSI.yellow
  }
  return ANSI.red
}

/**
 * Groups runs by eval ID and keeps order by ID.
 * @param {EvalResult[]} results
 */
function groupById(results) {
  const byId = {}
  for (const r of results) {
    if (!byId[r.id]) {
      byId[r.id] = { id: r.id, category: r.category, prompt: r.prompt, runs: [] }
    }
    byId[r.id].runs.push(r)
  }
  return byId
}

/**
 * Prints a summary table to the console.
 * @param {EvalResult[]} results
 * @param {ReportOptions} [options]
 */
export function printConsole(results, { verbose = false, inconclusive = false } = {}) {
  const line = '═'.repeat(60)
  console.log(`\n${ANSI.bold}CEP MCP Evals${ANSI.reset}`)
  console.log(line)
  console.log()

  const byId = groupById(results)
  const multiRun = Object.values(byId).some(e => e.runs.length > 1)

  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const counts = countByStatus(e.runs)
    const allPass = counts.passed === counts.total
    const anyFail = counts.failed > 0
    const caseStatus = anyFail ? Status.FAIL : allPass ? Status.PASS : Status.TRANSIENT
    const color = statusColor(caseStatus)

    const statusWord = `${color}${caseStatus}${ANSI.reset}`
    const breakdown = multiRun
      ? `${ANSI.dim}(${counts.passed} of ${counts.total} runs passed${counts.transient > 0 ? `, ${counts.transient} transient error${counts.transient === 1 ? '' : 's'}` : ''})${ANSI.reset}`
      : ''
    const title = truncate(e.prompt)
    const avgDurationMs = e.runs.reduce((sum, r) => sum + r.durationMs, 0) / counts.total
    const duration = `${ANSI.dim}${(avgDurationMs / 1000).toFixed(1)}s${multiRun ? '/run' : ''}${ANSI.reset}`
    console.log(
      `  ${e.id.padEnd(5)} ${statusWord.padEnd(13)} ${title.padEnd(52)} ${duration}${breakdown ? `  ${breakdown}` : ''}`,
    )

    const failedRuns = e.runs.filter(r => r.status === Status.FAIL)
    if (failedRuns.length > 0) {
      const firstFail = failedRuns[0]
      console.log(`  ${' '.repeat(5)}       ${ANSI.dim}(showing first failure, run ${firstFail.runIndex})${ANSI.reset}`)
      const reasons = [
        ...firstFail.deterministic.failures,
        ...(firstFail.judge.passed ? [] : [`Judge: ${firstFail.judge.reasoning}`]),
      ]
      for (const reason of reasons) {
        console.log(`  ${' '.repeat(5)}       ${ANSI.red}${reason}${ANSI.reset}`)
      }
      if (verbose) {
        printVerboseFailure(firstFail)
      }
    }

    const transientRuns = e.runs.filter(r => r.status === Status.TRANSIENT)
    if (transientRuns.length > 0 && failedRuns.length === 0) {
      const t = transientRuns[0].transient
      console.log(`  ${' '.repeat(5)}       ${ANSI.yellow}transient (${t.source}): ${t.message}${ANSI.reset}`)
    }
  }

  console.log()
  const overall = countByStatus(results)
  const summaryColor = overall.failed === 0 ? ANSI.green : ANSI.red
  const pct = (overall.passRate * 100).toFixed(1)
  const scored = overall.passed + overall.failed
  console.log(
    `${ANSI.bold}Results: ${summaryColor}${overall.passed} of ${scored} runs passed (${pct}% pass rate)${ANSI.reset}`,
  )
  if (overall.transient > 0) {
    const word = overall.transient === 1 ? 'error was' : 'errors were'
    console.log(
      `${ANSI.dim}         ${overall.transient} transient ${word} retried, then excluded from the pass rate.${ANSI.reset}`,
    )
  }
  if (inconclusive) {
    console.log(
      `${ANSI.bold}${ANSI.yellow}Run is INCONCLUSIVE: too many transient errors to trust the pass rate.${ANSI.reset}`,
    )
  }

  const categories = [...new Set(results.map(r => r.category))].sort()
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catCounts = countByStatus(catResults)
    const catScored = catCounts.passed + catCounts.failed
    const catPct = (catCounts.passRate * 100).toFixed(1)
    const catColor = catCounts.failed === 0 ? ANSI.green : ANSI.red
    const transientSuffix =
      catCounts.transient > 0
        ? `${ANSI.dim}; ${catCounts.transient} transient error${catCounts.transient === 1 ? '' : 's'}${ANSI.reset}`
        : ''
    console.log(
      `  ${cat.padEnd(20)} ${catColor}${catCounts.passed} of ${catScored} passed (${catPct}%)${ANSI.reset}${transientSuffix}`,
    )
  }
  console.log()
}

function printVerboseFailure(r) {
  if (r.toolCalls?.length > 0) {
    console.log(`  ${' '.repeat(5)}       ${ANSI.dim}Tools: ${r.toolCalls.map(tc => tc.name).join(', ')}${ANSI.reset}`)
  }
  if (r.responseText) {
    const lines = r.responseText.split('\n')
    const preview = lines.slice(0, RESPONSE_PREVIEW_LINES.console).join('\n')
    console.log(`  ${' '.repeat(5)}       ${ANSI.dim}Response:${ANSI.reset}`)
    for (const ln of preview.split('\n')) {
      console.log(`  ${' '.repeat(5)}       ${ANSI.dim}  ${ln}${ANSI.reset}`)
    }
    if (lines.length > RESPONSE_PREVIEW_LINES.console) {
      console.log(`  ${' '.repeat(5)}       ${ANSI.dim}  ... (${lines.length} lines total)${ANSI.reset}`)
    }
  }
}

/**
 * Writes results to a file. Format chosen by extension: `.md` or `.json`.
 * @param {EvalResult[]} results
 * @param {string} filepath
 * @param {ReportOptions} [options]
 */
export function writeResults(results, filepath, options = {}) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })

  if (filepath.endsWith('.md')) {
    writeMarkdown(results, filepath, options)
  } else {
    writeJson(results, filepath, options)
  }
  console.log(`Results written to ${filepath}`)
}

/**
 * @param {EvalResult[]} results
 * @param {string} filepath
 * @param {ReportOptions} options
 */
function writeMarkdown(results, filepath, { inconclusive = false } = {}) {
  const overall = countByStatus(results)
  const pct = (overall.passRate * 100).toFixed(1)
  const scored = overall.passed + overall.failed

  const lines = []
  lines.push(`# CEP MCP Eval Results`)
  lines.push('')
  lines.push(`**Date:** ${new Date().toISOString()}`)
  lines.push('')
  lines.push(
    `> **What "transient error" means:** an infrastructure / network / quota failure ` +
      `(e.g. a Gemini 503 or 429). The runner retries with backoff and, if it still ` +
      `fails, records the case as a transient error rather than a real failure. ` +
      `Transient errors are **excluded from the pass rate**.`,
  )
  lines.push('')
  if (inconclusive) {
    lines.push(
      `> ⚠️ **Run is INCONCLUSIVE.** Too many transient errors to trust the pass rate. ` +
        `Do not compare it against a baseline; rerun the workflow.`,
    )
    lines.push('')
  }
  lines.push(`## Summary`)
  lines.push('')
  lines.push(`- **${overall.passed} of ${scored} runs passed** (${pct}% pass rate).`)
  lines.push(`- **${overall.failed}** failed.`)
  lines.push(`- **${overall.transient}** hit a transient error (excluded from the pass rate).`)
  lines.push('')

  const categories = [...new Set(results.map(r => r.category))].sort()
  lines.push(`## Results by category`)
  lines.push('')
  lines.push(`| Category | Passed | Failed | Transient errors | Pass rate |`)
  lines.push(`|----------|--------|--------|------------------|-----------|`)
  for (const cat of categories) {
    const c = countByStatus(results.filter(r => r.category === cat))
    lines.push(`| ${cat} | ${c.passed} | ${c.failed} | ${c.transient} | ${(c.passRate * 100).toFixed(1)}% |`)
  }
  lines.push('')

  lines.push(`## Per-case results`)
  lines.push('')
  lines.push(`| ID | Category | Outcome | Pass rate |`)
  lines.push(`|----|----------|---------|-----------|`)
  const byId = groupById(results)
  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const c = countByStatus(e.runs)
    lines.push(`| **${id}** | ${e.category} | ${formatOutcome(c)} | ${(c.passRate * 100).toFixed(1)}% |`)
  }
  lines.push('')

  lines.push(`## Detailed failures`)
  lines.push('')
  for (const id of Object.keys(byId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const e = byId[id]
    const failedRuns = e.runs.filter(r => r.status === Status.FAIL)
    if (failedRuns.length === 0) {
      continue
    }
    const c = countByStatus(e.runs)
    lines.push(`### ${id}: ${formatOutcome(c)}`)
    lines.push(`**Prompt:** ${e.prompt}`)
    lines.push('')
    for (const r of failedRuns) {
      lines.push(`#### Run ${r.runIndex}`)
      if (r.toolCalls?.length > 0) {
        lines.push(`**Tools:** ${r.toolCalls.map(tc => tc.name).join(', ')}`)
      }
      if (r.deterministic.failures.length > 0) {
        lines.push(`**Failures:**`)
        for (const f of r.deterministic.failures) {
          lines.push(`- ${f}`)
        }
      }
      if (r.judge?.reasoning && !r.judge.skipped) {
        lines.push(`**Judge:** ${r.judge.reasoning}`)
      }
      if (r.responseText) {
        const responseLines = r.responseText.split('\n')
        const preview = responseLines.slice(0, RESPONSE_PREVIEW_LINES.markdown).join('\n')
        lines.push('')
        lines.push(`<details><summary>Response preview</summary>`)
        lines.push('')
        lines.push('```')
        lines.push(preview)
        if (responseLines.length > RESPONSE_PREVIEW_LINES.markdown) {
          lines.push(`... (${responseLines.length} lines total)`)
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

  fs.writeFileSync(filepath, lines.join('\n'))
}

/**
 * @param {EvalResult[]} results
 * @param {string} filepath
 * @param {ReportOptions} options
 */
function writeJson(results, filepath, { inconclusive = false } = {}) {
  const overall = countByStatus(results)

  const byCategory = {}
  for (const cat of new Set(results.map(r => r.category))) {
    const c = countByStatus(results.filter(r => r.category === cat))
    byCategory[cat] = {
      passed: c.passed,
      failed: c.failed,
      transient: c.transient,
      total: c.total,
      passRate: parseFloat((c.passRate * 100).toFixed(1)),
    }
  }

  const byId = groupById(results)
  const evaluations = Object.values(byId).map(e => {
    const c = countByStatus(e.runs)
    return {
      id: e.id,
      category: e.category,
      prompt: e.prompt,
      passed: c.passed,
      failed: c.failed,
      transient: c.transient,
      total: c.total,
      passRate: parseFloat((c.passRate * 100).toFixed(1)),
      isStable: c.failed === 0 && c.transient === 0,
      runs: e.runs.map(r => ({
        runIndex: r.runIndex,
        status: r.status,
        passed: r.passed,
        transient: r.transient,
        deterministic: r.deterministic,
        judge: r.judge,
        toolsCalled: r.toolCalls?.map(tc => tc.name) || [],
        responseText: r.responseText,
        durationMs: r.durationMs,
      })),
    }
  })

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: overall.passed,
      failed: overall.failed,
      transient: overall.transient,
      total: overall.total,
      passRate: parseFloat((overall.passRate * 100).toFixed(1)),
      inconclusive,
    },
    byCategory,
    evaluations,
  }

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2) + '\n')
}
