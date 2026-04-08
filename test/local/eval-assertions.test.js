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

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkForbidden, checkRequired, checkTools, runChecks } from '../evals/lib/assertions.js'

describe('Eval Assertions', () => {
  describe('checkForbidden', () => {
    it('should pass when no forbidden patterns match', () => {
      const result = checkForbidden('Chrome Enterprise Premium is great', ['bad_word', 'secret'])
      assert.ok(result.passed)
      assert.deepStrictEqual(result.failures, [])
    })

    it('should fail on case-insensitive substring match', () => {
      const result = checkForbidden('You should use search_content to find it', ['search_content'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('search_content'))
    })

    it('should fail on regex pattern (re: prefix)', () => {
      const result = checkForbidden('Use policies/abc123 for that', ['re:policies/\\w+'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
    })

    it('should pass when regex pattern does not match', () => {
      const result = checkForbidden('No policy references here', ['re:policies/\\w+'])
      assert.ok(result.passed)
    })

    it('should report multiple failures', () => {
      const result = checkForbidden('Call search_content then list_dlp_rules', [
        'search_content',
        'list_dlp_rules',
        'unused_pattern',
      ])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 2)
    })

    it('should handle empty patterns list', () => {
      const result = checkForbidden('anything goes', [])
      assert.ok(result.passed)
    })

    it('should fail gracefully on invalid regex instead of crashing', () => {
      const result = checkForbidden('some text', ['re:[invalid(regex'])
      assert.ok(!result.passed)
      assert.ok(result.failures[0].includes('invalid forbidden regex'))
    })
  })

  describe('checkRequired', () => {
    it('should pass when all required patterns found', () => {
      const result = checkRequired('CEP offers Zero Trust access and DLP protection', ['Zero Trust', 'DLP'])
      assert.ok(result.passed)
      assert.deepStrictEqual(result.failures, [])
    })

    it('should fail when a required pattern is missing', () => {
      const result = checkRequired('CEP offers DLP protection', ['Zero Trust', 'DLP'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('Zero Trust'))
    })

    it('should support regex patterns (re: prefix)', () => {
      const result = checkRequired('Price is $6/user/month', ['re:\\$\\d+'])
      assert.ok(result.passed)
    })

    it('should fail when regex required pattern not found', () => {
      const result = checkRequired('No prices mentioned', ['re:\\$\\d+'])
      assert.ok(!result.passed)
    })

    it('should be case-insensitive for substring matching', () => {
      const result = checkRequired('chrome enterprise premium', ['Chrome Enterprise Premium'])
      assert.ok(result.passed)
    })

    it('should handle empty patterns list', () => {
      const result = checkRequired('anything', [])
      assert.ok(result.passed)
    })

    it('should fail gracefully on invalid regex instead of crashing', () => {
      const result = checkRequired('some text', ['re:[invalid(regex'])
      assert.ok(!result.passed)
      assert.ok(result.failures[0].includes('invalid required regex'))
    })
  })

  describe('checkTools', () => {
    it('should pass when all expected tools were called', () => {
      const result = checkTools(['search_content', 'list_dlp_rules'], ['search_content'])
      assert.ok(result.passed)
    })

    it('should fail when an expected tool was not called', () => {
      const result = checkTools(['search_content'], ['search_content', 'list_dlp_rules'])
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 1)
      assert.ok(result.failures[0].includes('list_dlp_rules'))
    })

    it('should pass with empty expected list', () => {
      const result = checkTools(['search_content'], [])
      assert.ok(result.passed)
    })

    it('should pass when actual and expected are the same', () => {
      const result = checkTools(['a', 'b', 'c'], ['a', 'b', 'c'])
      assert.ok(result.passed)
    })
  })

  describe('runChecks', () => {
    it('should aggregate failures from all check types', () => {
      const evalCase = {
        forbiddenPatterns: ['search_content'],
        requiredPatterns: ['missing_thing'],
        expectedTools: ['tool_not_called'],
      }
      const result = runChecks('I used search_content', ['other_tool'], evalCase)
      assert.ok(!result.passed)
      assert.strictEqual(result.failures.length, 3)
    })

    it('should pass when everything is clean', () => {
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
