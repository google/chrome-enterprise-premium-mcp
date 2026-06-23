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
 * @file BeyondCorp API client wrapper using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * BeyondCorp API client wrapper using googleapis.
 */
export class BeyondCorpClient {
  /**
   * Initializes the client with API options.
   * @param {object} apiOptions Options to pass to the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the BeyondCorp service.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The BeyondCorp service instance.
   */
  async getService(authToken) {
    return createApiClient(
      google.beyondcorp,
      API_VERSIONS.BEYONDCORP,
      [SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Creates a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {object} gateway The gateway resource configuration.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The created gateway object or LRO metadata.
   */
  async createGateway(projectId, gatewayId, gateway, authToken) {
    logger.debug(`${TAGS.API} createGateway called for ${gatewayId} in project ${projectId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.create({
            parent: `projects/${projectId}/locations/global`,
            securityGatewayId: gatewayId,
            requestBody: gateway,
          }),
        'beyondcorp.projects.locations.securityGateways.create',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `creating secure gateway ${gatewayId}`)
    }
  }

  /**
   * Gets details of a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The gateway details.
   */
  async getGateway(projectId, gatewayId, authToken) {
    logger.debug(`${TAGS.API} getGateway called for ${gatewayId} in project ${projectId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.get({
            name: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.get',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting secure gateway ${gatewayId}`)
    }
  }

  /**
   * Updates a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {object} gateway The fields to update on the gateway.
   * @param {string} updateMask The update mask.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The updated gateway or LRO.
   */
  async patchGateway(projectId, gatewayId, gateway, updateMask, authToken) {
    logger.debug(`${TAGS.API} patchGateway called for ${gatewayId} in project ${projectId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.patch({
            name: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
            updateMask,
            requestBody: gateway,
          }),
        'beyondcorp.projects.locations.securityGateways.patch',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `updating secure gateway ${gatewayId}`)
    }
  }

  /**
   * Lists secure gateways.
   * @param {string} projectId The GCP project ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Array<object>>} List of gateways.
   */
  async listGateways(projectId, authToken) {
    logger.debug(`${TAGS.API} listGateways called for project ${projectId}`)
    const service = await this.getService(authToken)
    const gateways = []
    let pageToken
    try {
      do {
        const response = await callWithRetry(
          () =>
            service.projects.locations.securityGateways.list({
              parent: `projects/${projectId}/locations/global`,
              pageSize: 100,
              pageToken,
            }),
          'beyondcorp.projects.locations.securityGateways.list',
        )
        if (response.data.securityGateways) {
          gateways.push(...response.data.securityGateways)
        }
        pageToken = response.data.nextPageToken
      } while (pageToken)
      return gateways
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing secure gateways')
    }
  }

  /**
   * Deletes a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The LRO.
   */
  async deleteGateway(projectId, gatewayId, authToken) {
    logger.debug(`${TAGS.API} deleteGateway called for ${gatewayId} in project ${projectId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.delete({
            name: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.delete',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `deleting secure gateway ${gatewayId}`)
    }
  }

  /**
   * Creates a private web application in a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} applicationId The application ID.
   * @param {object} application The application resource configuration.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The created application or LRO.
   */
  async createApplication(projectId, gatewayId, applicationId, application, authToken) {
    logger.debug(`${TAGS.API} createApplication called for ${applicationId} on gateway ${gatewayId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.applications.create({
            parent: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
            applicationId,
            requestBody: application,
          }),
        'beyondcorp.projects.locations.securityGateways.applications.create',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `creating application ${applicationId}`)
    }
  }

  /**
   * Gets details of a private web application.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} applicationId The application ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The application details.
   */
  async getApplication(projectId, gatewayId, applicationId, authToken) {
    logger.debug(`${TAGS.API} getApplication called for ${applicationId} on gateway ${gatewayId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.applications.get({
            name: `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.applications.get',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting application ${applicationId}`)
    }
  }

  /**
   * Lists applications on a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Array<object>>} List of applications.
   */
  async listApplications(projectId, gatewayId, authToken) {
    logger.debug(`${TAGS.API} listApplications called for gateway ${gatewayId}`)
    const service = await this.getService(authToken)
    const applications = []
    let pageToken
    try {
      do {
        const response = await callWithRetry(
          () =>
            service.projects.locations.securityGateways.applications.list({
              parent: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
              pageSize: 100,
              pageToken,
            }),
          'beyondcorp.projects.locations.securityGateways.applications.list',
        )
        if (response.data.applications) {
          applications.push(...response.data.applications)
        }
        pageToken = response.data.nextPageToken
      } while (pageToken)
      return applications
    } catch (error) {
      handleApiError(error, TAGS.API, `listing applications for gateway ${gatewayId}`)
    }
  }

  /**
   * Deletes a private web application.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} applicationId The application ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The LRO.
   */
  async deleteApplication(projectId, gatewayId, applicationId, authToken) {
    logger.debug(`${TAGS.API} deleteApplication called for ${applicationId} on gateway ${gatewayId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.applications.delete({
            name: `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.applications.delete',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `deleting application ${applicationId}`)
    }
  }

  /**
   * Gets IAM Policy for a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The IAM policy.
   */
  async getGatewayIamPolicy(projectId, gatewayId, authToken) {
    logger.debug(`${TAGS.API} getGatewayIamPolicy called for ${gatewayId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.getIamPolicy({
            resource: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.getIamPolicy',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting IAM policy for secure gateway ${gatewayId}`)
    }
  }

  /**
   * Sets IAM Policy for a secure gateway.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {object} policy The policy object.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The updated IAM policy.
   */
  async setGatewayIamPolicy(projectId, gatewayId, policy, authToken) {
    logger.debug(`${TAGS.API} setGatewayIamPolicy called for ${gatewayId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.setIamPolicy({
            resource: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
            requestBody: {
              policy,
            },
          }),
        'beyondcorp.projects.locations.securityGateways.setIamPolicy',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `setting IAM policy for secure gateway ${gatewayId}`)
    }
  }

  /**
   * Gets IAM Policy for a private application.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} applicationId The application ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The IAM policy.
   */
  async getApplicationIamPolicy(projectId, gatewayId, applicationId, authToken) {
    logger.debug(`${TAGS.API} getApplicationIamPolicy called for ${applicationId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.applications.getIamPolicy({
            resource: `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`,
          }),
        'beyondcorp.projects.locations.securityGateways.applications.getIamPolicy',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting IAM policy for application ${applicationId}`)
    }
  }

  /**
   * Sets IAM Policy for a private application.
   * @param {string} projectId The GCP project ID.
   * @param {string} gatewayId The secure gateway ID.
   * @param {string} applicationId The application ID.
   * @param {object} policy The policy object.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The updated IAM policy.
   */
  async setApplicationIamPolicy(projectId, gatewayId, applicationId, policy, authToken) {
    logger.debug(`${TAGS.API} setApplicationIamPolicy called for ${applicationId}`)
    const service = await this.getService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.projects.locations.securityGateways.applications.setIamPolicy({
            resource: `projects/${projectId}/locations/global/securityGateways/${gatewayId}/applications/${applicationId}`,
            requestBody: {
              policy,
            },
          }),
        'beyondcorp.projects.locations.securityGateways.applications.setIamPolicy',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `setting IAM policy for application ${applicationId}`)
    }
  }
}
