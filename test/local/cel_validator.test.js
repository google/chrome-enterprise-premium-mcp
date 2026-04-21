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

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { validateCelCondition, validateActionParameters } from '../../lib/util/cel_validator.js'
import { CHROME_ACTION_TYPES } from '../../lib/util/chrome_dlp_constants.js'

describe('CEL Validator', () => {
  test('When a simple valid condition is provided, then it validates correctly', () => {
    const result = validateCelCondition("url.contains('google.com')")
    assert.strictEqual(result.isValid, true)
    assert.strictEqual(result.errors.length, 0)
  })

  test('When an empty condition is provided, then it fails validation', () => {
    const result = validateCelCondition('')
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.length > 0)
  })

  test('When unbalanced parentheses are provided, then it fails validation', () => {
    const result = validateCelCondition("url.contains('test'")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => /parentheses/i.test(e)))
  })

  test('When an invalid method is used, then it fails validation', () => {
    const result = validateCelCondition("url.invalid_method('test')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('invalid_method') || e.includes('function')))
  })

  test('When an invalid content type is used, then it fails validation', () => {
    const result = validateCelCondition("invalid_type.contains('test')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => /content type/i.test(e)))
  })

  test('When an invalid web category is used, then it fails validation', () => {
    const result = validateCelCondition("url_category.matches_web_category('INVALID_CAT')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('INVALID_CAT')))
  })

  test('When a valid web category is provided with URL_NAVIGATION trigger, then it passes validation', () => {
    const result = validateCelCondition("url_category.matches_web_category('ADULT')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, true)
  })

  test('When matches_web_category is used on url instead of url_category, then it fails validation', () => {
    const result = validateCelCondition("url.matches_web_category('ADULT')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('url_category')))
  })

  test('When matches_web_category is used without URL_NAVIGATION trigger, then it fails validation', () => {
    const result = validateCelCondition("url_category.matches_web_category('ADULT')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('URL_NAVIGATION')))
  })

  test('When source_url is used with URL_NAVIGATION trigger, then it fails validation', () => {
    const result = validateCelCondition("source_url.contains('test')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('source_url')))
  })

  test('When a valid source_chrome_context is used, then it passes validation', () => {
    const result = validateCelCondition("source_chrome_context == 'INCOGNITO'", ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, true)
  })

  test('When an invalid source_chrome_context is used, then it fails validation', () => {
    const result = validateCelCondition("source_chrome_context == 'PRIVATE'", ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('source_chrome_context')))
  })

  test('When matches_mime_types is not given a list, then it fails validation', () => {
    const result = validateCelCondition("file_type.matches_mime_types('application/pdf')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('matches_mime_types')))
  })

  test('When matches_mime_types is given a list, then it passes validation', () => {
    const result = validateCelCondition("file_type.matches_mime_types(['application/pdf'])", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, true)
  })

  test('When destination_url is used, then it fails validation', () => {
    const result = validateCelCondition("destination_url.contains('test')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('destination_url')))
  })

  test('When file attribute is used with WEB_CONTENT_UPLOAD trigger, then it fails validation', () => {
    const result = validateCelCondition('file_size_in_bytes > 1024', ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('file_size_in_bytes')))
  })

  test('When a valid predefined detector is used, then it passes validation', () => {
    const result = validateCelCondition("all_content.matches_dlp_detector('US_SOCIAL_SECURITY_NUMBER')", [
      'FILE_UPLOAD',
    ])
    assert.strictEqual(result.isValid, true)
  })

  test('When an invalid predefined detector is used, then it fails validation', () => {
    const result = validateCelCondition("all_content.matches_dlp_detector('INVALID_DETECTOR')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('INVALID_DETECTOR') && e.includes('predefined DLP detector')))
  })

  test('When a predefined detector is used with parameters, then it fails validation', () => {
    const result = validateCelCondition(
      "all_content.matches_dlp_detector('US_SOCIAL_SECURITY_NUMBER', {minimum_match_count: 2})",
      ['FILE_UPLOAD'],
    )
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('does not support a second parameters argument')))
  })

  describe('validateActionParameters', () => {
    test('When valid parameters are provided, then it passes validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: 'Blocked' }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, true)
    })

    test('When customMessage is too long, then it fails validation', () => {
      const longMessage = 'A'.repeat(301)
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: longMessage }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('300 characters')))
    })

    test('When watermarkMessage is used without URL_NAVIGATION trigger, then it fails validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { watermarkMessage: 'Test' }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && e.includes('URL_NAVIGATION')))
    })

    test('When blockScreenshot is used without URL_NAVIGATION trigger, then it fails validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { blockScreenshot: true }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('blockScreenshot') && e.includes('URL_NAVIGATION')))
    })

    test('When dataMasking is used without URL_NAVIGATION trigger, then it fails validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { dataMasking: { regexDetectors: [] } }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('dataMasking') && e.includes('URL_NAVIGATION')))
    })

    test('When AUDIT action is used with any trigger, then it passes validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.AUDIT, {}, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, true)
    })

    test('When advanced features are used with URL_NAVIGATION trigger, then it passes validation', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.WARN,
        {
          watermarkMessage: 'Test',
          blockScreenshot: true,
          dataMasking: { regexDetectors: [] },
        },
        ['URL_NAVIGATION'],
      )
      assert.strictEqual(result.isValid, true)
    })

    test('When dataMasking contains unsupported detectors, then it fails validation', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.WARN,
        {
          dataMasking: { wordListDetectors: [{}] },
        },
        ['URL_NAVIGATION'],
      )
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('ONLY regex detectors are supported for data masking')))
    })

    test('When customMessage contains unauthorized HTML tags, then it fails validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: '<b>Bold</b> not allowed' }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, false)
    })

    test('When <a> tag contains unauthorized attributes, then it fails validation', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.BLOCK,
        { customMessage: '<a href="http://google.com" onclick="alert(1)">Link</a>' },
        ['FILE_UPLOAD'],
      )
      assert.strictEqual(result.isValid, false)
    })

    test('When watermarkMessage is too long, then it fails validation', () => {
      const longWatermark = 'A'.repeat(61)
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { watermarkMessage: longWatermark }, [
        'URL_NAVIGATION',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && e.includes('characters')))
    })

    test('When customMessage contains only allowed <a> tags, then it passes validation', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.BLOCK,
        { customMessage: 'Click <a href="http://google.com">here</a>' },
        ['FILE_UPLOAD'],
      )
      assert.strictEqual(result.isValid, true)
    })

    test('When watermarkMessage is used with BLOCK action, then it fails validation', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { watermarkMessage: 'Test' }, [
        'URL_NAVIGATION',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && (e.includes('WARN') || e.includes('AUDIT'))))
    })
  })
})
