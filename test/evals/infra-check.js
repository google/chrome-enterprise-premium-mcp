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

/* eslint-disable n/no-process-exit */

/**
 * @file Catastrophic-failure detector for eval runs.
 *
 * A catastrophic run is one where zero cases passed. The most common cause is
 * an infrastructure failure (model id removed upstream, expired API key,
 * proxy outage), not a real eval regression. Drift detection in diff.js is
 * about pass-rate deltas; this script is the separate alarm for the
 * "nothing worked at all" case.
 *
 * Usage: node test/evals/infra-check.js <results.json>
 *
 * Exit codes: 0 = not catastrophic (or no results file); 1 = catastrophic;
 * 2 = bad input.
 */

import fs from 'node:fs'

const USAGE = 'Usage: node test/evals/infra-check.js <results.json>'

/**
 * Truncates a string for display, with a trailing ellipsis when shortened.
 * @param {string} s
 * @param {number} max
 * @returns {string}
 */
function truncate(s, max) {
  if (s.length <= max) {
    return s
  }
  return s.slice(0, max - 1) + '…'
}

/**
 * Collects every error message from a results object, regardless of whether
 * the run was bucketed as TRANSIENT or FAIL (with an "Agent error:" body).
 * @param {object} data - Parsed eval results JSON.
 * @returns {string[]}
 */
function collectErrorMessages(data) {
  const messages = []
  for (const evaluation of data.evaluations || []) {
    for (const run of evaluation.runs || []) {
      if (run.transient && typeof run.transient.message === 'string') {
        messages.push(run.transient.message)
        continue
      }
      if (typeof run.responseText === 'string' && run.responseText.startsWith('Agent error:')) {
        messages.push(run.responseText)
      }
    }
  }
  return messages
}

/**
 * Groups identical message prefixes and returns the top N by count.
 * @param {string[]} messages
 * @param {number} topN
 * @returns {{ prefix: string, count: number }[]}
 */
function topMessages(messages, topN) {
  const counts = new Map()
  for (const msg of messages) {
    const prefix = truncate(msg, 240)
    counts.set(prefix, (counts.get(prefix) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    process.exit(0)
  }
  if (args.length !== 1) {
    console.error(`infra-check: expected 1 argument, got ${args.length}\n${USAGE}`)
    process.exit(2)
  }

  const [resultsPath] = args
  let raw
  try {
    raw = fs.readFileSync(resultsPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`infra-check: results file not found: ${resultsPath}`)
      process.exit(2)
    }
    throw err
  }
  const data = JSON.parse(raw)

  const summary = data.summary || {}
  const { passed = 0, failed = 0, transient = 0, total = 0 } = summary
  if (total === 0) {
    console.error('infra-check: results contain zero runs; nothing to check')
    process.exit(2)
  }

  if (passed > 0) {
    process.exit(0)
  }

  const errors = collectErrorMessages(data)
  const top = topMessages(errors, 3)

  console.log(`Catastrophic eval failure: 0 of ${total} cases passed.`)
  console.log(`Breakdown: ${passed} pass, ${failed} fail, ${transient} transient.`)
  console.log('')
  if (top.length === 0) {
    console.log('No agent or judge error messages were recorded against the failing runs.')
    console.log('Likely cause is a non-API failure path; inspect the raw results file.')
  } else {
    console.log(`Most common error message${top.length === 1 ? '' : 's'}:`)
    for (const { prefix, count } of top) {
      console.log(`  (${count}×) ${prefix}`)
    }
  }
  process.exit(1)
}

main()
