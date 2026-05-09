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
 * @file Google Cloud Platform (GCP) utilities.
 *
 * Provides functions to:
 * - Check GCP environment metadata (project ID, region).
 * - Check and enable required GCP APIs.
 */

import { TAGS } from '../constants.js'
import { logger } from './logger.js'
import axios from 'axios'
import { ServiceUsageClient } from '../api/service_usage_client.js'

interface GCPInfo {
  project: string
  region: string
}

interface EnsureApisContext {
  serviceUsageClient: ServiceUsageClient
}

/**
 * Fetches metadata from the Google Cloud metadata server.
 * @param path The metadata path to fetch (e.g., `/computeMetadata/v1/...`)
 * @returns The metadata value as a string
 * @throws If the metadata request fails with a non-OK status
 */
async function fetchMetadata(path: string): Promise<string> {
  const response = await axios.get<string>(`http://metadata.google.internal${path}`, {
    headers: {
      'Metadata-Flavor': 'Google',
    },
    responseType: 'text',
    timeout: 3000,
  })

  return response.data
}

/**
 * Checks if the GCP metadata server is available and retrieves project ID and region.
 * @returns An object containing project and region, or null if not available
 */
export async function checkGCP(): Promise<GCPInfo | null> {
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
 * @param serviceUsageClient The Service Usage client
 * @param projectId The Google Cloud project ID
 * @param api The API identifier (e.g., 'run.googleapis.com')
 * @returns Resolves when the API is enabled.
 */
async function checkAndEnableApi(
  serviceUsageClient: ServiceUsageClient,
  projectId: string,
  api: string,
): Promise<void> {
  const service = await serviceUsageClient.getServiceStatus(projectId, api)

  if (service && service.state !== 'ENABLED') {
    const message = `API [${api}] is not enabled. Enabling...`
    logger.info(`${TAGS.API} ${message}`)

    await serviceUsageClient.enableService(projectId, api)
  }
}

/**
 * Ensures that the specified Google Cloud APIs are enabled for the given project.
 *
 * Iterates through the list of APIs, checking their status and enabling them if necessary.
 * Retries failed attempts once.
 * @param context The context object containing clients and other parameters
 * @param projectId The Google Cloud project ID
 * @param apis An array of API identifiers to check and enable
 * @returns Resolves when all specified APIs are enabled.
 * @throws If an API fails to enable or if there's an issue checking its status
 */
export async function ensureApisEnabled(context: EnsureApisContext, projectId: string, apis: string[]): Promise<void> {
  const message = 'Checking and enabling required APIs...'
  logger.info(`${TAGS.API} ${message}`)

  for (const api of apis) {
    try {
      await checkAndEnableApi(context.serviceUsageClient, projectId, api)
    } catch {
      // First attempt failed, log a warning and retry once after a delay.
      const warnMsg = `Failed to check/enable ${api}, retrying in 1s...`
      logger.warn(`${TAGS.API} ${warnMsg}`)

      await new Promise<void>(resolve => {
        setTimeout(resolve, 1000)
      })

      try {
        await checkAndEnableApi(context.serviceUsageClient, projectId, api)
      } catch (retryError) {
        const errorMessage = `Failed to ensure API [${api}] is enabled after retry. Please check manually.`
        logger.error(`${TAGS.API} ${errorMessage}`, retryError)
        throw new Error(errorMessage)
      }
    }
  }

  const successMsg = 'All required APIs are enabled.'
  logger.info(`${TAGS.API} ${successMsg}`)
}
