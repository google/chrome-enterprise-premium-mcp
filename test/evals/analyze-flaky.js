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
*/ import fs from 'fs'

const data = JSON.parse(fs.readFileSync('results/stability-check.json', 'utf-8'))
const flaky = data.evaluations.filter(e => !e.isStable)

const missingTools = {}
const forbiddenStrings = {}
const missingStrings = {}
let judgeFailsOnly = 0

for (const e of flaky) {
  const failedRuns = e.runs.filter(r => !r.passed)
  for (const r of failedRuns) {
    if (r.deterministic.failures.length === 0 && !r.judge.passed) {
      judgeFailsOnly++
    }
    for (const f of r.deterministic.failures) {
      if (f.startsWith('expected tool not called:')) {
        const tool = f.split('"')[1]
        missingTools[tool] = (missingTools[tool] || 0) + 1
      } else if (f.startsWith('forbidden string found:')) {
        const str = f.split('"')[1]
        forbiddenStrings[str] = (forbiddenStrings[str] || 0) + 1
      } else if (f.startsWith('required string missing:')) {
        const str = f.split('"')[1]
        missingStrings[str] = (missingStrings[str] || 0) + 1
      }
    }
  }
}

console.log(`Total flaky/failing cases: ${flaky.length} (out of ${data.evaluations.length} total)`)

console.log(`\n--- Most Frequently Missed Expected Tools (Across all failed runs) ---`)
Object.entries(missingTools)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${v}x : ${k}`))

console.log(`\n--- Most Frequently Triggered Forbidden Strings ---`)
Object.entries(forbiddenStrings)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${v}x : ${k}`))

console.log(`\n--- Most Frequently Missed Required Strings ---`)
Object.entries(missingStrings)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${v}x : ${k}`))

console.log(`\n--- Runs Failing ONLY the LLM Judge (semantic issues/hallucinations) ---`)
console.log(
  `  ${judgeFailsOnly} total runs failed strictly due to semantic inaccuracies or omissions according to the LLM judge.`,
)

const categories = {}
for (const e of flaky) {
  categories[e.category] = (categories[e.category] || 0) + 1
}
console.log(`\n--- Flaky Cases by Category ---`)
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k}: ${v} cases`))
