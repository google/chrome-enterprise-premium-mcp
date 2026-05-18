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

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isStdioMode } from '../../lib/util/gcp.js'

describe('GCP Environment Utilities', () => {
  describe('isStdioMode', () => {
    test('When GCP_STDIO is true, then it returns true regardless of PORT', () => {
      const savedStdio = process.env.GCP_STDIO
      const savedPort = process.env.PORT
      process.env.GCP_STDIO = 'true'
      process.env.PORT = '3000'
      try {
        assert.strictEqual(isStdioMode(), true)
      } finally {
        process.env.GCP_STDIO = savedStdio
        process.env.PORT = savedPort
      }
    })

    test('When GCP_STDIO is false, then it returns false regardless of PORT', () => {
      const savedStdio = process.env.GCP_STDIO
      const savedPort = process.env.PORT
      process.env.GCP_STDIO = 'false'
      delete process.env.PORT
      try {
        assert.strictEqual(isStdioMode(), false)
      } finally {
        process.env.GCP_STDIO = savedStdio
        process.env.PORT = savedPort
      }
    })

    test('When GCP_STDIO is unset and PORT is set, then it returns false (Cloud Run mode)', () => {
      const savedStdio = process.env.GCP_STDIO
      const savedPort = process.env.PORT
      delete process.env.GCP_STDIO
      process.env.PORT = '8080'
      try {
        assert.strictEqual(isStdioMode(), false)
      } finally {
        process.env.GCP_STDIO = savedStdio
        process.env.PORT = savedPort
      }
    })

    test('When GCP_STDIO is unset and PORT is unset, then it returns true (Local Stdio mode)', () => {
      const savedStdio = process.env.GCP_STDIO
      const savedPort = process.env.PORT
      delete process.env.GCP_STDIO
      delete process.env.PORT
      try {
        assert.strictEqual(isStdioMode(), true)
      } finally {
        process.env.GCP_STDIO = savedStdio
        process.env.PORT = savedPort
      }
    })
  })
})
