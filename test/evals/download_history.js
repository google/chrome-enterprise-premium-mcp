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
 * @file Downloads previous evaluation run artifacts from GitHub Actions to construct run history.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = path.resolve(__dirname, 'runs')

// Read current version as fallback
const packageJsonPath = path.resolve(__dirname, '../../package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const currentVersion = packageJson.version

/**
 * Executes a shell command and returns stdout.
 * @param {string} cmd The command to execute.
 * @returns {string} The command output.
 */
function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (err) {
    console.error(`Error running command: ${cmd}`, err.message)
    return ''
  }
}

/**
 * Main function to download run history from GitHub Actions.
 */
function main() {
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true })
  }

  console.log('Fetching list of recent successful workflow runs...')
  const runsJson = runCmd(
    'gh run list --workflow agent-evals.yml --status success --limit 7 --json databaseId,createdAt',
  )

  if (!runsJson) {
    console.log('No successful runs found or GitHub CLI is not configured/authenticated.')
    return
  }

  const runs = JSON.parse(runsJson)
  console.log(`Found ${runs.length} successful run(s). Downloading artifacts...`)

  runs.forEach(run => {
    const runId = run.databaseId
    const createdAtMs = new Date(run.createdAt).getTime()
    const tmpDir = path.join(RUNS_DIR, `tmp-${runId}`)

    console.log(`Downloading artifact for run ${runId}...`)
    runCmd(`gh run download ${runId} --name eval-results --dir "${tmpDir}"`)

    const evalFile = path.join(tmpDir, 'eval-latest.json')
    if (fs.existsSync(evalFile)) {
      try {
        const fileContent = fs.readFileSync(evalFile, 'utf8')
        const data = JSON.parse(fileContent)

        // Determine version and timestamp
        const version = data.version || currentVersion
        const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : createdAtMs

        const destFile = path.join(RUNS_DIR, `run-${version}-${timestamp}.json`)
        fs.writeFileSync(destFile, JSON.stringify(data, null, 2) + '\n')
        console.log(`Saved run to: test/evals/runs/run-${version}-${timestamp}.json`)
      } catch (err) {
        console.error(`Failed to parse evaluation output for run ${runId}:`, err.message)
      }
    } else {
      console.log(`Artifact file eval-latest.json not found in download for run ${runId}.`)
    }

    // Clean up temporary download directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  console.log('History download completed successfully.\n')
}

main()
