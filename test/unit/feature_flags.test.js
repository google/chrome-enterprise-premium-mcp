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
import { FeatureFlags, FLAGS } from '../../lib/util/feature_flags.js'

describe('FeatureFlags', () => {
  it('should return false by default when flag is not set', () => {
    const featureFlags = new FeatureFlags({})
    assert.strictEqual(featureFlags.isEnabled(FLAGS.DELETE_TOOL_ENABLED), false)
  })

  it('should return true when flag is set to "true"', () => {
    const featureFlags = new FeatureFlags({ [`EXPERIMENT_${FLAGS.DELETE_TOOL_ENABLED}`]: 'true' })
    assert.strictEqual(featureFlags.isEnabled(FLAGS.DELETE_TOOL_ENABLED), true)
  })

  it('should return true when flag is set to "1"', () => {
    const featureFlags = new FeatureFlags({ [`EXPERIMENT_${FLAGS.DELETE_TOOL_ENABLED}`]: '1' })
    assert.strictEqual(featureFlags.isEnabled(FLAGS.DELETE_TOOL_ENABLED), true)
  })

  it('should return false when flag is set to "false"', () => {
    const featureFlags = new FeatureFlags({ [`EXPERIMENT_${FLAGS.DELETE_TOOL_ENABLED}`]: 'false' })
    assert.strictEqual(featureFlags.isEnabled(FLAGS.DELETE_TOOL_ENABLED), false)
  })

  it('should be case-insensitive', () => {
    const featureFlags = new FeatureFlags({ [`EXPERIMENT_${FLAGS.DELETE_TOOL_ENABLED}`]: 'TRUE' })
    assert.strictEqual(featureFlags.isEnabled(FLAGS.DELETE_TOOL_ENABLED), true)
  })

  it('should throw an error when checking an unregistered flag (Always Strict)', () => {
    const featureFlags = new FeatureFlags({})
    assert.throws(() => featureFlags.isEnabled('UNKNOWN_FLAG'), /checking unknown flag "UNKNOWN_FLAG"/)
  })
})
