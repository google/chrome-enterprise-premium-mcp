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
import { checkForbidden, checkRequired, checkTools, runChecks } from '../evals/lib/assertions.js'

describe('Eval Assertions', () => {
  describe('checkForbidden', () => {
    test('When no forbidden patterns match, then it passes', () => {
      const result = checkForbidden('Chrome Enterprise Premium is great', ['bad_word', 'secret'])
      assert.ok(result.passed)
      assert.deepStrictEqual(result.failures, [])
    })

    test('When a forbidden pattern is found, then it fails with a case-insensitive match', () => {
      const result = checkForbidden('You should use search_content to find it', ['search_content'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('search_content'))
    })

    test('When a forbidden regex pattern is matched, then it fails', () => {
      const result = checkForbidden('Use policies/abc123 for that', ['re:policies/\\w+'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
    })

    test('When a forbidden regex pattern does not match, then it passes', () => {
      const result = checkForbidden('No policy references here', ['re:policies/\\w+'])
      assert.ok(result.passed)
    })

    test('When multiple forbidden patterns are found, then it reports all failures', () => {
      const result = checkForbidden('Call search_content then list_dlp_rules', [
        'search_content',
        'list_dlp_rules',
        'unused_pattern',
      ])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 2)
    })

    test('When the forbidden patterns list is empty, then it passes', () => {
      const result = checkForbidden('anything goes', [])
      assert.ok(result.passed)
    })

    test('When an invalid regex is provided, then it fails gracefully instead of crashing', () => {
      const result = checkForbidden('some text', ['re:[invalid(regex'])
      assert.ok(!result.passed)
      assert.ok(result.failures[0].includes('invalid forbidden regex'))
    })
  })

  describe('checkRequired', () => {
    test('When all required patterns are found, then it passes', () => {
      const result = checkRequired('CEP offers Zero Trust access and DLP protection', ['Zero Trust', 'DLP'])
      assert.ok(result.passed)
      assert.deepStrictEqual(result.failures, [])
    })

    test('When a required pattern is missing, then it fails', () => {
      const result = checkRequired('CEP offers DLP protection', ['Zero Trust', 'DLP'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('Zero Trust'))
    })

    test('When a required regex pattern is found, then it passes', () => {
      const result = checkRequired('Price is $6/user/month', ['re:\\$\\d+'])
      assert.ok(result.passed)
    })

    test('When a required regex pattern is missing, then it fails', () => {
      const result = checkRequired('No prices mentioned', ['re:\\$\\d+'])
      assert.ok(!result.passed)
    })

    test('When checking required patterns, then it uses case-insensitive matching', () => {
      const result = checkRequired('chrome enterprise premium', ['Chrome Enterprise Premium'])
      assert.ok(result.passed)
    })

    test('When the required patterns list is empty, then it passes', () => {
      const result = checkRequired('anything', [])
      assert.ok(result.passed)
    })

    test('When an invalid regex is provided, then it fails gracefully instead of crashing', () => {
      const result = checkRequired('some text', ['re:[invalid(regex'])
      assert.ok(!result.passed)
      assert.ok(result.failures[0].includes('invalid required regex'))
    })
  })

  describe('checkTools', () => {
    test('When all expected tools are called, then it passes', () => {
      const result = checkTools(['search_content', 'list_dlp_rules'], ['search_content'])
      assert.ok(result.passed)
    })

    test('When an expected tool is missing from actual calls, then it fails', () => {
      const result = checkTools(['search_content'], ['search_content', 'list_dlp_rules'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('list_dlp_rules'))
    })

    test('When there are no expected tools, then it passes regardless of actual calls', () => {
      const result = checkTools(['search_content'], [])
      assert.ok(result.passed)
    })

    test('When actual calls and expected tools are identical, then it passes', () => {
      const result = checkTools(['a', 'b', 'c'], ['a', 'b', 'c'])
      assert.ok(result.passed)
    })
  })

  describe('runChecks', () => {
    test('When multiple checks fail, then it aggregates all failures', () => {
      const evalCase = {
        forbiddenPatterns: ['search_content'],
        requiredPatterns: ['missing_thing'],
        expectedTools: ['tool_not_called'],
      }
      const result = runChecks('I used search_content', ['other_tool'], evalCase)
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 3)
    })

    test('When all checks pass, then it returns a passing result', () => {
      const evalCase = {
        forbiddenPatterns: ['bad_word'],
        requiredPatterns: ['good_word'],
        expectedTools: ['search_content'],
      }
      const result = runChecks('This has good_word in it', ['search_content'], evalCase)
      assert.ok(result.passed)
      assert.strictEqual(result.failures.length, 0)
    })
  })
})
