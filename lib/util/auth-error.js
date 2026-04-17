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

import { execFileSync } from 'node:child_process'
import { ERROR_MESSAGES } from '../constants.js'

let cachedIsGcloudInstalled = null

/**
 * Checks if the Google Cloud SDK (gcloud) is installed on the system.
 * @returns {boolean} True if gcloud is installed, false otherwise.
 */
function isGcloudInstalled() {
  if (cachedIsGcloudInstalled !== null) {
    return cachedIsGcloudInstalled
  }
  try {
    execFileSync('gcloud', ['--version'], { stdio: 'ignore' })
    cachedIsGcloudInstalled = true
  } catch {
    cachedIsGcloudInstalled = false
  }
  return cachedIsGcloudInstalled
}

/**
 * Attempts to suggest a suitable quota project ID using gcloud.
 * @param {string} errorMessage - The error message to parse for the API name.
 * @returns {string|null} A project ID if found, or null.
 */
function suggestQuotaProject(errorMessage) {
  if (!isGcloudInstalled()) {
    return null
  }

  try {
    // Try to get the current config project
    const configProject = execFileSync('gcloud', ['config', 'get-value', 'project'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (configProject && configProject !== '(unset)') {
      return configProject
    }

    // Identify the API from the error message
    const apiMatch = errorMessage.match(/The ([a-z0-9.-]+) API requires/)
    const apiName = apiMatch ? apiMatch[1] : null

    // Get a list of active projects.
    const projectsOutput = execFileSync(
      'gcloud',
      ['projects', 'list', '--filter=lifecycleState:ACTIVE', '--format=value(projectId)', '--limit=10'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()

    const candidates = projectsOutput.split('\n').filter(Boolean)

    if (candidates.length === 0) {
      return null
    }

    // If we know the API, check which project has it enabled
    if (apiName) {
      for (const projectId of candidates) {
        try {
          const serviceCheck = execFileSync(
            'gcloud',
            [
              'services',
              'list',
              '--project',
              projectId,
              '--enabled',
              `--filter=config.name:${apiName}`,
              '--format=value(config.name)',
            ],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
          ).trim()

          if (serviceCheck === apiName) {
            return projectId // Found a project with the API enabled!
          }
        } catch {
          // Ignore errors (e.g., insufficient permissions to list services)
        }
      }
    }

    // Fallback: Return the most recent project if no specific match found
    return candidates[0]
  } catch {
    // Ignore errors during suggestion
  }

  return null
}

/**
 * Generates a descriptive error message for authentication failures.
 *
 * Identifies specific error conditions (e.g., insufficient scopes, missing credentials)
 * and provides actionable instructions based on whether `gcloud` is installed.
 * @param {Error} error - The original error object thrown during authentication.
 * @returns {string} A formatted error message with instructions.
 */
export function getAuthErrorMessage(error) {
  const gcloudInstalled = isGcloudInstalled()
  const errorMessage = error.message || ''
  const isInsufficientScopes = errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isNoCredentials = errorMessage.toLowerCase().includes(ERROR_MESSAGES.NO_CREDENTIALS.toLowerCase())
  const isQuotaProjectNotSet = errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)

  let instruction = ''

  if (isInsufficientScopes) {
    if (gcloudInstalled) {
      instruction = `Your credentials have insufficient scopes. Please run:\ngcloud auth application-default login --scopes https://www.googleapis.com/auth/chrome.management.policy,https://www.googleapis.com/auth/chrome.management.reports.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/admin.directory.orgunit.readonly,https://www.googleapis.com/auth/admin.directory.customer.readonly,https://www.googleapis.com/auth/cloud-identity.policies`
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
    const suggestedProject = suggestQuotaProject(errorMessage)
    if (suggestedProject) {
      instruction = `The API requires a quota project, which is not set by default. We found a potential quota project "${suggestedProject}".\n\nPlease run:\ngcloud auth application-default set-quota-project ${suggestedProject}`
    } else if (gcloudInstalled) {
      instruction = `The API requires a quota project, which is not set by default. We couldn't automatically determine a suitable project.\n\nPlease find a valid project ID in the Google Cloud Console:\nhttps://console.cloud.google.com/cloud-resource-manager\n\nThen run:\ngcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
    } else {
      instruction = `The API requires a quota project. Please install the Google Cloud SDK and run: gcloud auth application-default set-quota-project <YOUR_PROJECT_ID>`
    }
  }

  const baseMessage = `ERROR: Google Cloud Application Default Credentials are not set up.\nAn unexpected error occurred during credential verification.\n\nFor more details or alternative setup methods, consider:\n1. If running locally, run: gcloud auth application-default login.\n2. Ensuring the \nGOOGLE_APPLICATION_CREDENTIALS\n environment variable points to a valid service account key file.\n3. If on a Google Cloud environment (e.g., GCE, Cloud Run), verify the associated service account has necessary permissions.\n\nOriginal error message from Google Auth Library: ${errorMessage}`

  if (instruction) {
    return `${instruction}\n\n---\n\n${baseMessage}`
  }

  return `ERROR: ${instruction || 'Authentication failed.'}\nOriginal error message: ${errorMessage}`
}
