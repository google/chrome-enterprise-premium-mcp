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
import { describe, it } from 'node:test'
import { validateCelCondition, validateActionParameters } from '../../lib/util/cel_validator.js'
import { CHROME_ACTION_TYPES } from '../../lib/util/chrome_dlp_constants.js'

describe('CEL Validator', () => {
  it('should validate a simple valid condition', () => {
    const result = validateCelCondition("url.contains('google.com')")
    assert.strictEqual(result.isValid, true)
    assert.strictEqual(result.errors.length, 0)
  })

  it('should fail on empty condition', () => {
    const result = validateCelCondition('')
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.length > 0)
  })

  it('should fail on unbalanced parentheses', () => {
    const result = validateCelCondition("url.contains('test'")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => /parentheses/i.test(e)))
  })

  it('should fail on invalid method', () => {
    const result = validateCelCondition("url.invalid_method('test')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('invalid_method') || e.includes('function')))
  })

  it('should fail on invalid content type', () => {
    const result = validateCelCondition("invalid_type.contains('test')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => /content type/i.test(e)))
  })

  it('should fail on invalid web category', () => {
    const result = validateCelCondition("url_category.matches_web_category('INVALID_CAT')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('INVALID_CAT')))
  })

  it('should pass on valid web category', () => {
    const result = validateCelCondition("url_category.matches_web_category('ADULT')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, true)
  })

  it('should fail if matches_web_category is used on url instead of url_category', () => {
    const result = validateCelCondition("url.matches_web_category('ADULT')")
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('url_category')))
  })

  it('should fail if matches_web_category is used without URL_NAVIGATION trigger', () => {
    const result = validateCelCondition("url_category.matches_web_category('ADULT')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('URL_NAVIGATION')))
  })

  it('should fail if source_url is used with URL_NAVIGATION trigger', () => {
    const result = validateCelCondition("source_url.contains('test')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('source_url')))
  })

  it('should pass for valid enum values', () => {
    const result = validateCelCondition("url.matches_enum('HIGH')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, true)
  })

  it('should fail for invalid enum values', () => {
    const result = validateCelCondition("url.matches_enum('INVALID_LEVEL')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('INVALID_LEVEL')))
  })

  it('should pass for valid source_chrome_context', () => {
    const result = validateCelCondition("source_chrome_context == 'INCOGNITO'", ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, true)
  })

  it('should fail for invalid source_chrome_context', () => {
    const result = validateCelCondition("source_chrome_context == 'PRIVATE'", ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('source_chrome_context')))
  })

  it('should fail if matches_mime_types is not given a list', () => {
    const result = validateCelCondition("file_type.matches_mime_types('application/pdf')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('matches_mime_types')))
  })

  it('should pass if matches_mime_types is given a list', () => {
    const result = validateCelCondition("file_type.matches_mime_types(['application/pdf'])", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, true)
  })

  it('should fail if destination_url is used', () => {
    const result = validateCelCondition("destination_url.contains('test')", ['URL_NAVIGATION'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('destination_url')))
  })

  it('should fail if url.matches_enum is used without URL_NAVIGATION', () => {
    const result = validateCelCondition("url.matches_enum('HIGH')", ['FILE_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('url.matches_enum') || e.includes('URL_NAVIGATION')))
  })

  it('should fail if file attribute is used with WEB_CONTENT_UPLOAD', () => {
    const result = validateCelCondition('file_size_in_bytes > 1024', ['WEB_CONTENT_UPLOAD'])
    assert.strictEqual(result.isValid, false)
    assert.ok(result.errors.some(e => e.includes('file_size_in_bytes')))
  })

  describe('validateActionParameters', () => {
    it('should pass for valid parameters', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: 'Blocked' }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, true)
    })

    it('should fail if customMessage is too long', () => {
      const longMessage = 'A'.repeat(301)
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: longMessage }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('300 characters')))
    })

    it('should fail if watermarkMessage is used without URL_NAVIGATION', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { watermarkMessage: 'Test' }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && e.includes('URL_NAVIGATION')))
    })

    it('should fail if blockScreenshot is used without URL_NAVIGATION', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { blockScreenshot: true }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('blockScreenshot') && e.includes('URL_NAVIGATION')))
    })

    it('should fail if dataMasking is used without URL_NAVIGATION', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { dataMasking: [{}] }, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('dataMasking') && e.includes('URL_NAVIGATION')))
    })

    it('should pass for AUDIT action with any trigger', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.AUDIT, {}, ['FILE_UPLOAD'])
      assert.strictEqual(result.isValid, true)
    })

    it('should pass for advanced features with URL_NAVIGATION', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.WARN,
        {
          watermarkMessage: 'Test',
          blockScreenshot: true,
          dataMasking: [{}],
        },
        ['URL_NAVIGATION'],
      )
      assert.strictEqual(result.isValid, true)
    })

    it('should fail if customMessage contains unauthorized HTML tags', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { customMessage: '<b>Bold</b> not allowed' }, [
        'FILE_UPLOAD',
      ])
      assert.strictEqual(result.isValid, false)
    })

    it('should fail if <a> tag contains unauthorized attributes', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.BLOCK,
        { customMessage: '<a href="http://google.com" onclick="alert(1)">Link</a>' },
        ['FILE_UPLOAD'],
      )
      assert.strictEqual(result.isValid, false)
    })

    it('should pass if customMessage contains only allowed <a> tags', () => {
      const longWatermark = 'A'.repeat(61)
      const result = validateActionParameters(CHROME_ACTION_TYPES.WARN, { watermarkMessage: longWatermark }, [
        'URL_NAVIGATION',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && e.includes('characters')))
    })

    it('should pass if customMessage contains only allowed <a> tags', () => {
      const result = validateActionParameters(
        CHROME_ACTION_TYPES.BLOCK,
        { customMessage: 'Click <a href="http://google.com">here</a>' },
        ['FILE_UPLOAD'],
      )
      assert.strictEqual(result.isValid, true)
    })

    it('should fail if watermarkMessage is used with BLOCK action', () => {
      const result = validateActionParameters(CHROME_ACTION_TYPES.BLOCK, { watermarkMessage: 'Test' }, [
        'URL_NAVIGATION',
      ])
      assert.strictEqual(result.isValid, false)
      assert.ok(result.errors.some(e => e.includes('watermarkMessage') && (e.includes('WARN') || e.includes('AUDIT'))))
    })
  })
})
