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

import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = path.resolve(__dirname, '../../evals/runs')

test('Daily Trend Reporter', async t => {
  // Setup: create runs directory if not exists
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true })
  }

  // Back up existing run files
  const existingFiles = fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('run-') && f.endsWith('.json'))
  const backupDir = path.join(RUNS_DIR, 'backup-test-temp')
  if (existingFiles.length > 0) {
    fs.mkdirSync(backupDir, { recursive: true })
    existingFiles.forEach(f => {
      fs.renameSync(path.join(RUNS_DIR, f), path.join(backupDir, f))
    })
  }

  await t.test('reports correctly when no runs are present', () => {
    const stdout = execFileSync(process.execPath, [path.resolve(__dirname, '../../evals/reporter.js')], {
      encoding: 'utf8',
    })
    assert.match(stdout, /No evaluation runs found/)
  })

  await t.test('supports hyphenated pre-release version names in files', () => {
    // Populate fake runs
    const goldenRun = {
      timestamp: new Date().toISOString(),
      summary: { passed: 10, failed: 2, total: 12, passRate: 83.3 },
      evaluations: [
        { id: 'm01', category: 'mutation', failed: 0, total: 1 },
        { id: 'm02', category: 'mutation', failed: 1, total: 1 },
        { id: 'm03', category: 'mutation', failed: 1, total: 1 },
      ],
    }
    fs.writeFileSync(path.join(RUNS_DIR, 'run-1.8.0-beta-1700000000000.json'), JSON.stringify(goldenRun))

    const latestRun = {
      timestamp: new Date().toISOString(),
      summary: { passed: 11, failed: 1, total: 12, passRate: 91.7 },
      evaluations: [
        { id: 'm01', category: 'mutation', failed: 0, total: 1 },
        { id: 'm02', category: 'mutation', failed: 0, total: 1 },
        { id: 'm03', category: 'mutation', failed: 1, total: 1 },
      ],
    }
    fs.writeFileSync(path.join(RUNS_DIR, 'run-1.9.0-1700000000001.json'), JSON.stringify(latestRun))

    const stdout = execFileSync(process.execPath, [path.resolve(__dirname, '../../evals/reporter.js')], {
      encoding: 'utf8',
    })

    // Check golden comparison outputs
    assert.match(stdout, /Golden Run Comparison/)
    assert.match(stdout, /Golden Run \(Previous Version 1.8.0-beta\)/)

    // Cleanup fake runs
    const files = fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('run-') && f.endsWith('.json'))
    files.forEach(f => fs.unlinkSync(path.join(RUNS_DIR, f)))
  })

  await t.test('analyzes recent runs and highlights failures & improvements', () => {
    // Populate fake runs
    // Older runs: version 1.8.0
    const goldenRun = {
      timestamp: new Date().toISOString(),
      summary: { passed: 10, failed: 2, total: 12, passRate: 83.3 },
      evaluations: [
        { id: 'm01', category: 'mutation', failed: 0, total: 1 },
        { id: 'm02', category: 'mutation', failed: 1, total: 1 },
        { id: 'm03', category: 'mutation', failed: 1, total: 1 },
      ],
    }
    fs.writeFileSync(path.join(RUNS_DIR, 'run-1.8.0-1700000000000.json'), JSON.stringify(goldenRun))

    // 7 recent runs: version 1.9.0
    for (let i = 1; i <= 7; i++) {
      const run = {
        timestamp: new Date().toISOString(),
        summary: { passed: 11, failed: 1, total: 12, passRate: 91.7 },
        evaluations: [
          { id: 'm01', category: 'mutation', failed: 0, total: 1 },
          { id: 'm02', category: 'mutation', failed: 0, total: 1 }, // m02 improved!
          { id: 'm03', category: 'mutation', failed: 1, total: 1 }, // m03 failed consistently!
        ],
      }
      fs.writeFileSync(path.join(RUNS_DIR, `run-1.9.0-170000000000${i}.json`), JSON.stringify(run))
    }

    const stdout = execFileSync(process.execPath, [path.resolve(__dirname, '../../evals/reporter.js')], {
      encoding: 'utf8',
    })

    // Check persistent failure alert on m03
    assert.match(stdout, /Persistent Failures Alert/)
    assert.match(stdout, /m03/)

    // Check golden comparison
    assert.match(stdout, /Golden Run Comparison/)
    assert.match(stdout, /Improvements \(Failed in Golden, now Passing\)/)
    assert.match(stdout, /m02/) // m02 was failed in 1.8.0, now passing in 1.9.0

    // Cleanup fake runs
    const files = fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('run-') && f.endsWith('.json'))
    files.forEach(f => fs.unlinkSync(path.join(RUNS_DIR, f)))
  })

  // Teardown: restore backed up run files
  if (fs.existsSync(backupDir)) {
    const backups = fs.readdirSync(backupDir)
    backups.forEach(f => {
      fs.renameSync(path.join(backupDir, f), path.join(RUNS_DIR, f))
    })
    fs.rmdirSync(backupDir)
  }
})
