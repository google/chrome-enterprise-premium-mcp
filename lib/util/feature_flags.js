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

/**
 * @file Feature Flags and Experiments management.
 */

/**
 * Prefix for all experimental feature flag environment variables.
 */
const PREFIX = 'EXPERIMENT_'

/**
 * Centralized list of feature flag names.
 */
export const FLAGS = {
  DELETE_TOOL_ENABLED: 'DELETE_TOOL_ENABLED',
}

/**
 * Manages feature flags and experiments for the MCP server.
 * Flags are typically sourced from environment variables.
 */
export class FeatureFlags {
  /**
   * Initializes a new instance of FeatureFlags.
   * @param {object} [env] - The environment variables object to use for flag lookups.
   */
  constructor(env = process.env) {
    this.env = env
  }

  /**
   * Checks if a feature flag is enabled.
   * @param {string} flag - The name of the flag to check. MUST be a value from FLAGS.
   * @param {boolean} [defaultValue] - The default value if the flag is not set.
   * @returns {boolean} True if the flag is enabled, false otherwise.
   * @throws {Error} If the provided flag is not registered in the FLAGS constant.
   */
  isEnabled(flag, defaultValue = false) {
    // Strict check to catch typos during development and CI
    if (!Object.values(FLAGS).includes(flag)) {
      throw new Error(`[FeatureFlags] Error: checking unknown flag "${flag}". You must register it in FLAGS first.`)
    }

    const value = this.env[`${PREFIX}${flag}`]
    if (value === undefined || value === null) {
      return defaultValue
    }

    // Defensive check: Ensure value is a string before calling toLowerCase
    const stringValue = String(value).toLowerCase()
    return stringValue === 'true' || stringValue === '1'
  }
}

/**
 * Default instance of FeatureFlags using process.env.
 */
export const featureFlags = new FeatureFlags()
