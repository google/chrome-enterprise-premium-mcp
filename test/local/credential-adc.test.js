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
import { adcCredential } from '../../lib/util/credential/adc.js'

describe('adcCredential', () => {
  describe('probe', () => {
    it('When ADC is not configured, then it returns ok:false with source:adc', async () => {
      // Force GoogleAuth to fail by pointing at a nonexistent credential file.
      const origValue = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/path.json'
      try {
        const cred = adcCredential()
        const probe = await cred.probe()
        assert.equal(probe.ok, false)
        assert.equal(probe.source, 'adc')
      } finally {
        if (origValue === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          // eslint-disable-next-line require-atomic-updates
          process.env.GOOGLE_APPLICATION_CREDENTIALS = origValue
        }
      }
    })
  })
})
