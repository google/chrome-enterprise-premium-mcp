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
  KNOWLEDGE_SEARCH_ENABLED: 'KNOWLEDGE_SEARCH_ENABLED',
  DIAGNOSE_TOOL_ENABLED: 'DIAGNOSE_TOOL_ENABLED',
} as const

export type FeatureFlagName = (typeof FLAGS)[keyof typeof FLAGS]

/**
 * Centralized default values for flags if not explicitly set in the environment.
 */
const DEFAULT_VALUES: Record<FeatureFlagName, boolean> = {
  [FLAGS.DELETE_TOOL_ENABLED]: false,
  [FLAGS.KNOWLEDGE_SEARCH_ENABLED]: false,
  [FLAGS.DIAGNOSE_TOOL_ENABLED]: true,
}

/**
 * Manages feature flags and experiments for the MCP server.
 * Flags are sourcing from environment variables.
 */
export class FeatureFlags {
  private env: NodeJS.ProcessEnv

  /**
   * Initializes a new instance of FeatureFlags.
   * @param env The environment variables object to use for flag lookups.
   */
  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env
  }

  /**
   * Checks if a feature flag is enabled.
   * @param flag The name of the flag to check. MUST be a value from FLAGS.
   * @param defaultValue Optional override for the centralized default value.
   * @returns True if the flag is enabled, false otherwise.
   * @throws If the provided flag is not registered in the FLAGS constant.
   */
  isEnabled(flag: FeatureFlagName, defaultValue?: boolean): boolean {
    // Strict check to catch typos during development and CI
    const validFlags: string[] = Object.values(FLAGS)
    if (!validFlags.includes(flag)) {
      throw new Error(`[FeatureFlags] Error: checking unknown flag "${flag}". You must register it in FLAGS first.`)
    }

    const value = this.env[`${PREFIX}${flag}`]
    if (value === undefined || value === null) {
      // Use the provided override, or the centralized default, or fall back to false
      return defaultValue !== undefined ? defaultValue : (DEFAULT_VALUES[flag] ?? false)
    }

    // Defensive check: Ensure value is a string before calling toLowerCase
    const stringValue = String(value).toLowerCase()
    return stringValue === 'true' || stringValue === '1'
  }

  /**
   * Checks if a feature flag is currently using its default value from the environment.
   * @param flag The name of the flag to check.
   * @returns True if the flag is NOT set in the environment.
   */
  isDefault(flag: FeatureFlagName): boolean {
    return this.env[`${PREFIX}${flag}`] === undefined || this.env[`${PREFIX}${flag}`] === null
  }

  /**
   * Logs all currently active environment overrides to the console.
   */
  logActive(): void {
    const overrides = Object.values(FLAGS)
      .filter(f => !this.isDefault(f))
      .map(f => `${f}=${this.isEnabled(f)}`)
    console.log(`Experiment Overrides: ${overrides.length > 0 ? overrides.join(', ') : 'None'}`)
  }
}

/**
 * Default instance of FeatureFlags using process.env.
 */
export const featureFlags = new FeatureFlags()
