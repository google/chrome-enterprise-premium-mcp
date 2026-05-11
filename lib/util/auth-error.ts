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
 * quota project) and returns actionable remediation instructions.
 */

import { execFile } from 'node:child_process'
import { ERROR_MESSAGES, SCOPES } from '../constants.js'

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
 * Generates a descriptive error message for authentication failures.
 *
 * Identifies specific error conditions (e.g., insufficient scopes, missing credentials)
 * and provides actionable instructions based on whether `gcloud` is installed.
 * @param {Error} error - The original error object thrown during authentication.
 * @returns {string} A formatted error message with instructions.
 */
export async function getAuthErrorMessage(error) {
  const gcloudInstalled = await isGcloudInstalled()
  const errorMessage = error.message || ''
  const isInsufficientScopes = errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isNoCredentials = errorMessage.toLowerCase().includes(ERROR_MESSAGES.NO_CREDENTIALS.toLowerCase())
  const isQuotaProjectNotSet = errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)

  let instruction = ''

  if (isInsufficientScopes) {
    if (gcloudInstalled) {
      instruction = `Your credentials have insufficient scopes. Please run:\ngcloud auth application-default login --scopes ${Object.values(SCOPES).join(',')}`
    } else {
      instruction = `Your credentials have insufficient scopes and gcloud is not installed. Please install the Google Cloud SDK and then run the login command with required scopes.`
    }
  } else if (isNoCredentials) {
    if (gcloudInstalled) {
      instruction = `No credentials found. Please run:\ngcloud auth application-default login`
    } else {
      instruction = `No credentials found and gcloud is not installed. Please install the Google Cloud SDK and then run gcloud auth application-default login.`
    }
  } else if (isQuotaProjectNotSet) {
    const suggestedProject = await suggestQuotaProject(errorMessage)
    if (suggestedProject) {
      instruction = `The API requires a quota project, which is not set by default. We found a potential quota project "${suggestedProject}".\n\nPlease run:\ngcloud auth application-default set-quota-project ${suggestedProject}`
    } else if (gcloudInstalled) {
      instruction = `The API requires a quota project, which is not set by default. We couldn't automatically determine a suitable project.\n\nPlease find a valid project ID in the Google Cloud Console:\nhttps://console.cloud.google.com/cloud-resource-manager\n\nThen run:\ngcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
    } else {
      instruction = `The API requires a quota project. Please install the Google Cloud SDK and run: gcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
    }
  }

  const baseMessage = `ERROR: Google Cloud Application Default Credentials are not set up.\nAn unexpected error occurred during credential verification.\n\nFor more details or alternative setup methods, consider:\n1. If running locally, run: gcloud auth application-default login.\n2. Ensuring the GOOGLE_APPLICATION_CREDENTIALS environment variable points to a valid service account key file.\n3. If on a Google Cloud environment (e.g., GCE, Cloud Run), verify the associated service account has necessary permissions.\n\nOriginal error message from Google Auth Library: ${errorMessage}`

  if (instruction) {
    return `${instruction}\n\n---\n\n${baseMessage}`
  }

  return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
}
