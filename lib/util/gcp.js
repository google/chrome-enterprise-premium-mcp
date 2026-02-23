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
 * @fileoverview Google Cloud Platform (GCP) utilities.
 *
 * Provides functions to:
 * - Check GCP environment metadata (project ID, region).
 * - Check and enable required GCP APIs.
 */

import { callWithRetry } from './helpers.js'
import { TAGS } from '../constants.js'

/**
 * Fetches metadata from the Google Cloud metadata server.
 *
 * @param {string} path - The metadata path to fetch (e.g., `/computeMetadata/v1/...`)
 * @returns {Promise<string>} A promise that resolves to the metadata value as a string
 * @throws {Error} If the metadata request fails with a non-OK status
 */
async function fetchMetadata(path) {
  const response = await fetch(`http://metadata.google.internal${path}`, {
    headers: {
      'Metadata-Flavor': 'Google',
    },
  })

  if (!response.ok) {
    throw new Error(`Metadata request failed with status ${response.status}`)
  }

  return response.text()
}

/**
 * Checks if the GCP metadata server is available and retrieves project ID and region.
 *
 * @returns {Promise<{project: string, region: string}|null>} An object containing project and region, or null if not available
 */
export async function checkGCP() {
  try {
    const projectId = await fetchMetadata('/computeMetadata/v1/project/project-id')
    // Expected format: projects/PROJECT_NUMBER/regions/REGION_NAME
    const regionPath = await fetchMetadata('/computeMetadata/v1/instance/region')

    if (projectId && regionPath) {
      const regionParts = regionPath.split('/')
      const region = regionParts[regionParts.length - 1]
      return { project: projectId, region }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Checks if a single Google Cloud API is enabled and enables it if not.
 *
 * @param {object} serviceUsageClient - The Service Usage client
 * @param {string} serviceName - The full name of the service (e.g., 'projects/my-project/services/run.googleapis.com')
 * @param {string} api - The API identifier (e.g., 'run.googleapis.com')
 * @param {function(object): void} [progressCallback] - A function to call with progress updates
 * @returns {Promise<void>} A promise that resolves when the API is enabled
 */
async function checkAndEnableApi(serviceUsageClient, serviceName, api, progressCallback) {
  const [service] = await callWithRetry(() => serviceUsageClient.getService({ name: serviceName }), `getService ${api}`)

  if (service.state !== 'ENABLED') {
    const message = `API [${api}] is not enabled. Enabling...`
    console.error(`${TAGS.API} ${message}`)
    progressCallback?.({ level: 'info', data: message })

    const [operation] = await callWithRetry(
      () => serviceUsageClient.enableService({ name: serviceName }),
      `enableService ${api}`,
    )
    await operation.promise()
  }
}

/**
 * Ensures that the specified Google Cloud APIs are enabled for the given project.
 *
 * Iterates through the list of APIs, checking their status and enabling them if necessary.
 * Retries failed attempts once.
 *
 * @param {object} context - The context object containing clients and other parameters
 * @param {string} projectId - The Google Cloud project ID
 * @param {string[]} apis - An array of API identifiers to check and enable
 * @param {function(object): void} [progressCallback] - A function to call with progress updates
 * @returns {Promise<void>} A promise that resolves when all specified APIs are enabled
 * @throws {Error} If an API fails to enable or if there's an issue checking its status
 */
export async function ensureApisEnabled(context, projectId, apis, progressCallback) {
  const message = 'Checking and enabling required APIs...'
  console.error(`${TAGS.API} ${message}`)
  progressCallback?.({ level: 'info', data: message })

  for (const api of apis) {
    const serviceName = `projects/${projectId}/services/${api}`

    try {
      await checkAndEnableApi(context.serviceUsageClient, serviceName, api, progressCallback)
    } catch {
      // First attempt failed, log a warning and retry once after a delay.
      const warnMsg = `Failed to check/enable ${api}, retrying in 1s...`
      console.error(`${TAGS.API} ⚠️ ${warnMsg}`)
      progressCallback?.({ level: 'warn', data: warnMsg })

      await new Promise(resolve => setTimeout(resolve, 1000))

      try {
        await checkAndEnableApi(context.serviceUsageClient, serviceName, api, progressCallback)
      } catch (retryError) {
        const errorMessage = `Failed to ensure API [${api}] is enabled after retry. Please check manually.`
        console.error(`${TAGS.API} ✗ ${errorMessage}`, retryError)
        progressCallback?.({ level: 'error', data: errorMessage })
        throw new Error(errorMessage)
      }
    }
  }

  const successMsg = 'All required APIs are enabled.'
  console.error(`${TAGS.API} ✓ ${successMsg}`)
  progressCallback?.({ level: 'info', data: successMsg })
}
