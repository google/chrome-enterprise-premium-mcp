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

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJudgeResult } from '../evals/lib/judge.js'

describe('parseJudgeResult', () => {
  test('When RESULT: PASS begins a line followed by reasoning, then it returns true', () => {
    assert.ok(parseJudgeResult('RESULT: PASS\nReasoning: The response is correct.'))
  })

  test('When result: pass appears in lowercase on its own line, then it returns true', () => {
    assert.ok(parseJudgeResult('result: pass'))
  })

  test('When RESULT: PASS has leading whitespace before it on the line, then it returns true', () => {
    assert.ok(parseJudgeResult('  RESULT: PASS\nREASONING: Meets all criteria.'))
  })

  test('When RESULT: PASS appears mid-sentence in a negation, then it returns false', () => {
    assert.ok(!parseJudgeResult('This does not meet RESULT: PASS criteria'))
  })

  test('When the judge returns RESULT: FAIL, then it returns false', () => {
    assert.ok(!parseJudgeResult('RESULT: FAIL\nREASONING: The response is missing key details.'))
  })

  test('When RESULT: PASSING appears (partial word match), then it returns false', () => {
    assert.ok(!parseJudgeResult('RESULT: PASSING\nREASONING: Word boundary should reject this.'))
  })

  test('When the text explicitly negates RESULT: PASS mid-sentence, then it returns false', () => {
    assert.ok(!parseJudgeResult('It is not appropriate to mark RESULT: PASS here.'))
  })

  test('When the text is empty, then it returns false', () => {
    assert.ok(!parseJudgeResult(''))
  })

  test('When RESULT: PASS appears after a newline mid-document, then it returns true', () => {
    assert.ok(parseJudgeResult('Some preamble text.\nRESULT: PASS\nREASONING: All good.'))
  })
})
