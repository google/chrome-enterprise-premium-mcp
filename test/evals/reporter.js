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
 * @file Daily evaluation trend and regression reporter.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = path.resolve(__dirname, 'runs')

// Read package.json to get version
const packageJsonPath = path.resolve(__dirname, '../../package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const currentVersion = packageJson.version

/**
 * Scans the runs directory and returns sorted runs details.
 * @returns {Array<{file: string, filepath: string, version: string, timestamp: number}>} Sorted runs.
 */
function getRunFiles() {
  if (!fs.existsSync(RUNS_DIR)) {
    return []
  }
  return fs
    .readdirSync(RUNS_DIR)
    .filter(file => file.startsWith('run-') && file.endsWith('.json'))
    .map(file => {
      const parts = file
        .replace(/^run-/, '')
        .replace(/\.json$/, '')
        .split('-')
      let version = ''
      let timestamp = 0
      if (parts.length >= 2) {
        timestamp = parseInt(parts[parts.length - 1], 10)
        version = parts.slice(0, -1).join('-')
      } else {
        timestamp = parseInt(parts[0], 10)
      }
      return {
        file,
        filepath: path.join(RUNS_DIR, file),
        version,
        timestamp,
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Main execution of the evaluation reporter.
 */
function run() {
  const runFiles = getRunFiles()
  if (runFiles.length === 0) {
    console.log('No evaluation runs found in test/evals/runs/')
    return
  }

  // 1. Get the last 7 runs
  const lastRuns = runFiles.slice(0, 7)
  console.log(`Analyzing last ${lastRuns.length} run(s) from history...\n`)

  const failCounts = {}
  const totalCounts = {}
  const evalCategories = {}

  lastRuns.forEach(runInfo => {
    try {
      const data = JSON.parse(fs.readFileSync(runInfo.filepath, 'utf8'))
      const evals = data.evaluations || []
      evals.forEach(ev => {
        const id = ev.id
        evalCategories[id] = ev.category
        if (!failCounts[id]) {
          failCounts[id] = 0
          totalCounts[id] = 0
        }
        totalCounts[id] += ev.total
        failCounts[id] += ev.failed
      })
    } catch (err) {
      console.error(`Failed to parse run file ${runInfo.file}:`, err.message)
    }
  })

  // Filter evals that failed more than 3 times
  const persistentFailures = Object.keys(failCounts)
    .map(id => ({
      id,
      category: evalCategories[id],
      failures: failCounts[id],
      totalRuns: totalCounts[id],
    }))
    .filter(item => item.failures > 3)
    .sort((a, b) => b.failures - a.failures)

  // Print persistent failures
  console.log('## ⚠️ Persistent Failures Alert (> 3 failures in last 7 runs)')
  if (persistentFailures.length === 0) {
    console.log('No persistent failures found. Clean bill of health across recent runs! 🎉\n')
  } else {
    console.log('| Eval ID | Category | Failure Count | Total Runs checked |')
    console.log('| :--- | :--- | :--- | :--- |')
    persistentFailures.forEach(item => {
      console.log(`| **${item.id}** | ${item.category} | ${item.failures} | ${item.totalRuns} |`)
    })
    console.log()
  }

  const latestRunInfo = runFiles[0]
  const goldenRunInfo = runFiles.find(runInfo => runInfo.version && runInfo.version !== latestRunInfo.version)

  if (latestRunInfo && goldenRunInfo) {
    console.log(`## 🏆 Golden Run Comparison`)
    console.log(`- **Latest Run (Current Version ${latestRunInfo.version || currentVersion}):** ${latestRunInfo.file}`)
    console.log(`- **Golden Run (Previous Version ${goldenRunInfo.version}):** ${goldenRunInfo.file}\n`)

    try {
      const latestData = JSON.parse(fs.readFileSync(latestRunInfo.filepath, 'utf8'))
      const goldenData = JSON.parse(fs.readFileSync(goldenRunInfo.filepath, 'utf8'))

      const latestStatus = {}
      ;(latestData.evaluations || []).forEach(ev => {
        latestStatus[ev.id] = ev.failed === 0
      })

      const goldenStatus = {}
      ;(goldenData.evaluations || []).forEach(ev => {
        goldenStatus[ev.id] = ev.failed === 0
      })

      const regressions = []
      const improvements = []

      Object.keys(latestStatus).forEach(id => {
        const latestPassed = latestStatus[id]
        const goldenPassed = goldenStatus[id]

        if (goldenPassed === undefined) {
          return
        }

        if (goldenPassed && !latestPassed) {
          regressions.push(id)
        } else if (!goldenPassed && latestPassed) {
          improvements.push(id)
        }
      })

      if (regressions.length === 0 && improvements.length === 0) {
        console.log('No regressions or improvements detected compared to the golden release run. Stable! 🟢\n')
      } else {
        if (regressions.length > 0) {
          console.log(`### 🔴 Regressions (Passed in Golden, now Failing):`)
          regressions.forEach(id => console.log(`- **${id}** (${evalCategories[id]})`))
          console.log()
        }
        if (improvements.length > 0) {
          console.log(`### 🟢 Improvements (Failed in Golden, now Passing):`)
          improvements.forEach(id => console.log(`- **${id}** (${evalCategories[id]})`))
          console.log()
        }
      }
    } catch (err) {
      console.error('Failed to compare with golden run:', err.message)
    }
  } else {
    console.log('## 🏆 Golden Run Comparison')
    console.log('Golden run (previous version) or latest run details not found for comparison. ⚪\n')
  }
}

run()
