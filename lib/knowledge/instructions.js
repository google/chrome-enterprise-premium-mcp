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
 * @file Builds the `instructions` string returned in the MCP InitializeResult.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SYSTEM_PROMPT_PATH = path.resolve(__dirname, '../../prompts/system-prompt.md')
const CAPABILITIES_PATH = path.resolve(__dirname, './0-agent-capabilities.md')
const ADDENDUM_PATH = path.resolve(__dirname, './98-agent-knowledge-addendum.md')

let cachedPayload = null

/**
 * Returns the `instructions` string for the MCP InitializeResult.
 * @returns {string} System prompt + capabilities contract + technical addendum.
 */
export function buildServerInstructions() {
  if (cachedPayload === null) {
    cachedPayload = [
      fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8'),
      fs.readFileSync(CAPABILITIES_PATH, 'utf8'),
      fs.readFileSync(ADDENDUM_PATH, 'utf8'),
    ].join('\n\n---\n\n')
  }
  return cachedPayload
}
