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
 * @file Compares two eval JSON outputs (baseline vs. current) and exits
 * non-zero when the pass rate has regressed beyond the threshold.
 *
 * Usage: node test/evals/diff.js <baseline.json> <current.json> [--threshold <pct>]
 *
 * Exit codes: 0 = within threshold or no baseline; 1 = regression; 2 = bad input.
 */

import fs from 'node:fs'

const DEFAULT_THRESHOLD_PCT = 5

const USAGE =
  'Usage: node test/evals/diff.js <baseline.json> <current.json> [--threshold <pct>]\n' +
  `Default threshold: ${DEFAULT_THRESHOLD_PCT}%`

/**
 * Parses positional args and an optional `--threshold <pct>` flag from argv.
 * @param {string[]} argv - argv slice excluding the node binary and script path.
 * @returns {{ baseline: string, current: string, threshold: number } | { help: true } | { error: string }} parsed CLI shape.
 */
function parseCli(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true }
  }

  let threshold = DEFAULT_THRESHOLD_PCT
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--threshold') {
      const next = argv[++i]
      if (next === undefined) {
        return { error: `--threshold requires a value` }
      }
      threshold = Number.parseFloat(next)
      if (!Number.isFinite(threshold) || threshold < 0) {
        return { error: `invalid --threshold: ${next}` }
      }
    } else if (arg.startsWith('--threshold=')) {
      threshold = Number.parseFloat(arg.slice('--threshold='.length))
      if (!Number.isFinite(threshold) || threshold < 0) {
        return { error: `invalid --threshold: ${arg}` }
      }
    } else if (arg.startsWith('-')) {
      return { error: `unknown flag: ${arg}` }
    } else {
      positionals.push(arg)
    }
  }

  if (positionals.length !== 2) {
    return { error: `expected 2 positional args (baseline, current), got ${positionals.length}` }
  }
  return { baseline: positionals[0], current: positionals[1], threshold }
}

/**
 * Reads and validates an eval result JSON file. Returns null when the file
 * does not exist (a no-baseline-yet state is not an error).
 * @param {string} filepath - Absolute or relative path to the JSON file.
 * @returns {object | null} Parsed JSON object, or null if the file is absent.
 */
function readEvalJson(filepath) {
  let raw
  try {
    raw = fs.readFileSync(filepath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null
    }
    throw err
  }
  const data = JSON.parse(raw)
  if (!data.summary || typeof data.summary.passRate !== 'number') {
    throw new Error(`${filepath}: missing summary.passRate (file may be from an older runner)`)
  }
  return data
}

/**
 * Formats a number as a fixed-precision percentage string (e.g. `92.0%`).
 * @param {number} n - The percentage value.
 * @returns {string} Formatted percentage with one decimal place.
 */
function fmtPct(n) {
  return `${n.toFixed(1)}%`
}

/**
 * Returns cases that were clean in the baseline but have failures in the
 * current run. Useful for surfacing concentrated regressions even when the
 * overall pass rate is within threshold.
 * @param {object} baseline - Parsed baseline eval JSON.
 * @param {object} current  - Parsed current eval JSON.
 * @returns {{ id: string, category: string }[]} Flipped cases by ID + category.
 */
function flippedCases(baseline, current) {
  const baselineById = new Map(baseline.evaluations.map(e => [e.id, e]))
  const flips = []
  for (const cur of current.evaluations) {
    const base = baselineById.get(cur.id)
    if (!base) {
      continue
    }
    if (base.failed === 0 && cur.failed > 0) {
      flips.push({ id: cur.id, category: cur.category })
    }
  }
  return flips
}

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  const cli = parseCli(process.argv.slice(2))
  if ('help' in cli) {
    console.log(USAGE)
    process.exit(0)
  }
  if ('error' in cli) {
    console.error(`eval-diff: ${cli.error}\n${USAGE}`)
    process.exit(2)
  }

  const { baseline: baselinePath, current: currentPath, threshold } = cli

  let baseline
  let current
  try {
    baseline = readEvalJson(baselinePath)
    current = readEvalJson(currentPath)
  } catch (err) {
    console.error(`eval-diff: ${err.message}`)
    process.exit(2)
  }

  if (!current) {
    console.error(`eval-diff: current results file not found: ${currentPath}`)
    process.exit(2)
  }

  if (current.summary.inconclusive) {
    console.log(
      `Skipping comparison: the current run hit too many transient errors ` +
        `(infrastructure / network / quota failures) to be trusted. Rerun the workflow.`,
    )
    process.exit(0)
  }

  if (!baseline) {
    console.log(
      `No baseline file at ${baselinePath} yet, so there is nothing to compare against.\n` +
        `Pass rate this run: ${fmtPct(current.summary.passRate)}.`,
    )
    process.exit(0)
  }

  if (baseline.summary.inconclusive) {
    console.log(
      `Skipping comparison: the baseline file was recorded from an inconclusive run ` +
        `(too many transient errors). Refresh the baseline before comparing again.`,
    )
    process.exit(0)
  }

  const delta = current.summary.passRate - baseline.summary.passRate
  const regressed = delta < 0 && Math.abs(delta) > threshold

  console.log(`Comparing eval results against baseline:`)
  console.log(`  Baseline pass rate:  ${fmtPct(baseline.summary.passRate)}` + summarizeCounts(baseline.summary))
  console.log(`  Current pass rate:   ${fmtPct(current.summary.passRate)}` + summarizeCounts(current.summary))
  const direction = delta > 0 ? 'improvement' : delta < 0 ? 'regression' : 'no change'
  console.log(`  Change:              ${fmtSignedPct(delta)} (${direction})`)
  console.log(`  Threshold:           ${fmtPct(threshold)} drop allowed before failing`)

  const flips = flippedCases(baseline, current)
  if (flips.length > 0) {
    console.log(`\nCases that were clean in the baseline but failed this run:`)
    for (const f of flips) {
      console.log(`  - ${f.id} (${f.category})`)
    }
  }

  if (regressed) {
    console.log(
      `\nREGRESSION: pass rate dropped by ${fmtPct(Math.abs(delta))}, which exceeds the ${fmtPct(threshold)} threshold.`,
    )
    process.exit(1)
  }
  console.log(`\nWithin threshold. No regression.`)
  process.exit(0)
}

/**
 * Renders a one-line summary of a run's counts: passed / failed / transient.
 * @param {{ passed: number, failed: number, transient: number, total: number }} s - Summary counts from the eval JSON.
 * @returns {string} Human-readable count summary, prefixed with two spaces.
 */
function summarizeCounts(s) {
  const decisive = s.passed + s.failed
  const tail = s.transient > 0 ? `, ${s.transient} transient error${s.transient === 1 ? '' : 's'} excluded` : ''
  return `  (${s.passed} of ${decisive} runs passed${tail})`
}

/**
 * Formats a signed percentage delta for display (e.g. "+0.5%", "-10.0%").
 * @param {number} pct - Signed percentage value.
 * @returns {string} Formatted string with explicit sign.
 */
function fmtSignedPct(pct) {
  if (pct === 0) {
    return '0.0%'
  }
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
}

main()
