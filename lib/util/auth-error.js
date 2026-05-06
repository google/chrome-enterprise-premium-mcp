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
 * @file Human-readable error messages for Google Cloud auth failures.
 *
 * Detects specific credential issues (insufficient scopes, missing ADC, missing
 * quota project) and returns actionable remediation instructions. Branches on
 * the active credential source: ADC errors get gcloud-flavored guidance, while
 * OAuth-flow errors get `mcp auth login` and `GOOGLE_CLOUD_QUOTA_PROJECT`
 * guidance instead.
 */

import { execFile } from 'node:child_process'
import { ERROR_MESSAGES, SCOPES } from '../constants.js'
import { TokenCache } from './credential/token_cache.js'

const GCLOUD_CALL_TIMEOUT_MS = 1000
const GCLOUD_TOTAL_BUDGET_MS = 5000

let cachedIsGcloudInstalled = /** @type {boolean|null} */ (null)
let gcloudCheckPromise = /** @type {Promise<boolean>|null} */ (null)

/**
 * Runs a gcloud command with a per-call timeout. Returns stdout or null on error/timeout.
 * @param {string[]} args - Arguments to pass to gcloud.
 * @returns {Promise<string|null>} The stdout output, or null if the call fails or times out.
 */
function runGcloud(args) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), GCLOUD_CALL_TIMEOUT_MS)
    execFile('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }, (err, stdout) => {
      clearTimeout(timer)
      resolve(err ? null : stdout)
    })
  })
}

/**
 * Checks if the Google Cloud SDK (gcloud) is installed on the system.
 * @returns {Promise<boolean>} True if gcloud is installed, false otherwise.
 */
function isGcloudInstalled() {
  if (cachedIsGcloudInstalled !== null) {
    return Promise.resolve(cachedIsGcloudInstalled)
  }
  if (!gcloudCheckPromise) {
    gcloudCheckPromise = runGcloud(['--version']).then(result => {
      cachedIsGcloudInstalled = result !== null
      return cachedIsGcloudInstalled
    })
  }
  return gcloudCheckPromise
}

/**
 * Attempts to suggest a suitable quota project ID using gcloud.
 * @param {string} errorMessage - The error message to parse for the API name.
 * @returns {Promise<string|null>} A project ID if found, or null.
 */
async function suggestQuotaProject(errorMessage) {
  if (!(await isGcloudInstalled())) {
    return null
  }

  const budgetStart = Date.now()

  const configOutput = await runGcloud(['config', 'get-value', 'project'])
  const configProject = configOutput ? configOutput.trim() : ''
  if (configProject && configProject !== '(unset)') {
    return configProject
  }

  if (Date.now() - budgetStart >= GCLOUD_TOTAL_BUDGET_MS) {
    return null
  }

  // Identify the API from the error message
  const apiMatch = errorMessage.match(/The ([a-z0-9.-]+) API requires/)
  const apiName = apiMatch ? apiMatch[1] : null

  // Get a list of active projects.
  const projectsOutput = await runGcloud([
    'projects',
    'list',
    '--filter=lifecycleState:ACTIVE',
    '--format=value(projectId)',
    '--limit=10',
  ])

  const candidates = projectsOutput ? projectsOutput.trim().split('\n').filter(Boolean) : []

  if (candidates.length === 0) {
    return null
  }

  // If we know the API, check which project has it enabled
  if (apiName) {
    for (const projectId of candidates) {
      if (Date.now() - budgetStart >= GCLOUD_TOTAL_BUDGET_MS) {
        break
      }

      const serviceOutput = await runGcloud([
        'services',
        'list',
        '--project',
        projectId,
        '--enabled',
        `--filter=config.name:${apiName}`,
        '--format=value(config.name)',
      ])

      if (serviceOutput && serviceOutput.trim() === apiName) {
        return projectId
      }
    }
  }

  // Fallback: Return the most recent project if no specific match found
  return candidates[0]
}

/**
 * Detects whether the active credential is from the OAuth-flow cache rather
 * than ADC. Returns 'oauth' when valid cached OAuth tokens are present,
 * 'adc' otherwise. Callers can override by passing `options.authMode`.
 * @returns {Promise<'oauth'|'adc'>} The detected mode.
 */
async function detectAuthMode() {
  try {
    const cache = new TokenCache(TokenCache.defaultPath())
    const tokens = await cache.read()
    if (tokens && tokens.access_token) {
      return 'oauth'
    }
  } catch {
    // Cache unreadable — fall through to ADC.
  }
  return 'adc'
}

/**
 * Builds the ADC-flavored remediation instruction (gcloud commands).
 * @param {object} ctx - Detection context.
 * @param {boolean} ctx.isInsufficientScopes - Whether the error indicates missing scopes.
 * @param {boolean} ctx.isNoCredentials - Whether the error indicates missing credentials.
 * @param {boolean} ctx.isQuotaProjectNotSet - Whether the error indicates a missing quota project.
 * @param {boolean} ctx.gcloudInstalled - Whether gcloud is installed locally.
 * @param {string} ctx.errorMessage - The raw error message.
 * @returns {Promise<string>} The instruction text, or '' when no specific path matches.
 */
async function buildAdcInstruction({
  isInsufficientScopes,
  isNoCredentials,
  isQuotaProjectNotSet,
  gcloudInstalled,
  errorMessage,
}) {
  if (isInsufficientScopes) {
    if (gcloudInstalled) {
      return `Your credentials have insufficient scopes. Please run:\ngcloud auth application-default login --scopes ${Object.values(SCOPES).join(',')}`
    }
    return `Your credentials have insufficient scopes and gcloud is not installed. Please install the Google Cloud SDK and then run the login command with required scopes.`
  }
  if (isNoCredentials) {
    if (gcloudInstalled) {
      return `No credentials found. Please run:\ngcloud auth application-default login`
    }
    return `No credentials found and gcloud is not installed. Please install the Google Cloud SDK and then run gcloud auth application-default login.`
  }
  if (isQuotaProjectNotSet) {
    const suggestedProject = await suggestQuotaProject(errorMessage)
    if (suggestedProject) {
      return `The API requires a quota project, which is not set by default. We found a potential quota project "${suggestedProject}".\n\nPlease run:\ngcloud auth application-default set-quota-project ${suggestedProject}`
    }
    if (gcloudInstalled) {
      return `The API requires a quota project, which is not set by default. We couldn't automatically determine a suitable project.\n\nPlease find a valid project ID in the Google Cloud Console:\nhttps://console.cloud.google.com/cloud-resource-manager\n\nThen run:\ngcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
    }
    return `The API requires a quota project. Please install the Google Cloud SDK and run: gcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
  }
  return ''
}

/**
 * Builds the OAuth-flow remediation instruction. Avoids gcloud and points at
 * `mcp auth login` plus `GOOGLE_CLOUD_QUOTA_PROJECT` instead.
 * @param {object} ctx - Detection context.
 * @param {boolean} ctx.isInsufficientScopes - Whether the error indicates missing scopes.
 * @param {boolean} ctx.isNoCredentials - Whether the error indicates missing credentials.
 * @param {boolean} ctx.isQuotaProjectNotSet - Whether the error indicates a missing quota project.
 * @returns {string} The instruction text, or '' when no specific path matches.
 */
function buildOAuthInstruction({ isInsufficientScopes, isNoCredentials, isQuotaProjectNotSet }) {
  if (isInsufficientScopes) {
    return `The cached OAuth token is missing one or more required scopes. Re-run \`mcp auth login\` to re-consent with the updated scope set.`
  }
  if (isNoCredentials) {
    return `No OAuth tokens cached. Run \`mcp auth login\` to authenticate, or set up Application Default Credentials with \`gcloud auth application-default login\`.`
  }
  if (isQuotaProjectNotSet) {
    return `The API requires a quota project. Set \`GOOGLE_CLOUD_QUOTA_PROJECT\` in your environment or \`.env\` file to a GCP project ID you have access to. The OAuth-flow path does not use ADC's \`set-quota-project\` mechanism.`
  }
  return ''
}

/**
 * Generates a descriptive error message for authentication failures.
 *
 * Identifies specific error conditions (e.g., insufficient scopes, missing
 * credentials, missing quota project) and provides actionable instructions
 * tailored to the active credential source — ADC remediations use gcloud,
 * OAuth-flow remediations use `mcp auth login` and `GOOGLE_CLOUD_QUOTA_PROJECT`.
 * @param {Error} error - The original error object thrown during authentication.
 * @param {object} [options] - Override options.
 * @param {'oauth'|'adc'} [options.authMode] - Skip detection and force a remediation flavor.
 * @returns {Promise<string>} A formatted error message with instructions.
 */
export async function getAuthErrorMessage(error, options = {}) {
  const errorMessage = error.message || ''
  const isInsufficientScopes = errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isNoCredentials = errorMessage.toLowerCase().includes(ERROR_MESSAGES.NO_CREDENTIALS.toLowerCase())
  const isQuotaProjectNotSet = errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)

  const authMode = options.authMode ?? (await detectAuthMode())

  let instruction = ''
  if (authMode === 'oauth') {
    instruction = buildOAuthInstruction({ isInsufficientScopes, isNoCredentials, isQuotaProjectNotSet })
  } else {
    const gcloudInstalled = await isGcloudInstalled()
    instruction = await buildAdcInstruction({
      isInsufficientScopes,
      isNoCredentials,
      isQuotaProjectNotSet,
      gcloudInstalled,
      errorMessage,
    })
  }

  if (authMode === 'oauth') {
    if (instruction) {
      return `${instruction}\n\nOriginal error message from Google Auth Library: ${errorMessage}`
    }
    return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
  }

  const baseMessage = `ERROR: Google Cloud Application Default Credentials are not set up.\nAn unexpected error occurred during credential verification.\n\nFor more details or alternative setup methods, consider:\n1. If running locally, run: gcloud auth application-default login.\n2. Ensuring the GOOGLE_APPLICATION_CREDENTIALS environment variable points to a valid service account key file.\n3. If on a Google Cloud environment (e.g., GCE, Cloud Run), verify the associated service account has necessary permissions.\n\nOriginal error message from Google Auth Library: ${errorMessage}`

  if (instruction) {
    return `${instruction}\n\n---\n\n${baseMessage}`
  }

  return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
}
