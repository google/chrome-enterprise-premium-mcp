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

import { google } from 'googleapis';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { callWithRetry } from '../util/helpers.js';

let policyClient;
let customerId;

async function getPolicyClient(authToken) {
  // TODO(shadas): Remove this once we verify cloud run by default can support oauth token worflow
  if (authToken) {
    console.log(`Using OAuth token for policy client.`);
    const auth = new OAuth2Client();
    auth.setCredentials({access_token: authToken});
    google.options({ auth: auth });
    console.log(`Initialized cloudidentity policy client with OAuth token.`);
    return google.cloudidentity('v1beta1');
  }

  if (policyClient) {
    return policyClient;
  }
  const auth = new GoogleAuth({
    // Using the mutation scope as defined in the User Guide Section 3 [cite: 33]
    scopes: ['https://www.googleapis.com/auth/cloud-identity.policies'],
  });
  const authClient = await auth.getClient();

  try {
    await authClient.getAccessToken();
    console.log('Application default creds found')
  }
  catch (error) {
    console.error(
      'ERROR: Google Cloud Application Default Credentials are not set up.'
    );

    if (error.response && error.response.status) {
      console.error(
        `An HTTP error occurred (Status: ${error.response.status}). This often means misconfigured, expired credentials, or a network issue.`
      );
    } else if (error instanceof TypeError) {
      // Catches TypeErrors specifically, which might indicate a malformed response or unexpected data type
      console.error(
        'An unexpected error occurred during credential verification (e.g., malformed response or invalid type).'
      );
    } else {
      // General fallback for any other unexpected errors
      console.error(
        'An unexpected error occurred during credential verification.'
      );
    }
  }
  google.options({ auth: authClient });

  // Using v1beta1 because Create/Update/Delete are in Beta [cite: 12]
  policyClient = google.cloudidentity('v1beta1');
  console.log(`Initialized cloudidentity policy client with application default credentials.`);
  return policyClient;
}

/**
 * Lists DLP rules or detectors for a given customer.
 * @param {string} projectId - The Google Cloud project ID.
 * @param {string} [type] - Optional 'rule' or 'detector' to filter results.
 * @param {function(object): void} [progressCallback] - Optional callback.
 * @param {string} [oauthToken] - Optional OAuth token.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of policies.
 */
export async function listDlpPolicies(type, progressCallback, authToken) {
  // await ensureApisEnabled({serviceUsageClient}, projectId, ['cloudidentity.googleapis.com'], progressCallback);
  const client = await getPolicyClient(authToken);
  try {
    console.log(`Listing DLP policies for customer ${customerId}...`);

    // Constructing filter based on Appendix A and Request Query [cite: 38]
    let filter = '';
    if (type === 'rule') {
        filter = 'setting.type.matches("rule.dlp")';
    } else if (type === 'detector') {
        filter = 'setting.type.matches("detector")';
    }

    let nextPageToken;
    const allPolicies = [];
    do {
      const request = {
        filter: filter,
        pageSize: 50,
        pageToken: nextPageToken,
      };

      const response = await callWithRetry(
        () => client.policies.list(request),
        'policies.list'
      );

      if (response.data.policies) {
        allPolicies.push(...response.data.policies);
      }
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return allPolicies;
  } catch (error) {
    console.error(`Error listing DLP policies:`, error);
    throw error;
  }
}

/**
 * Creates a new Chrome DLP Rule for a specific Org Unit.
 * @param {string} customerId - The customer ID (e.g. C012345).
 * @param {string} orgUnitId - The target Org Unit ID (e.g. 03ph8a2z1enflrv).
 * @param {object} ruleConfig - Configuration object for the rule.
 * @param {string} ruleConficang.displayName - Name of the rule[cite: 82].
 * @param {string} [ruleConfig.description] - Description of the rule.
 * @param {string[]} ruleConfig.triggers - Array of trigger strings (e.g. ["google.workspace.chrome.file.v1.download"])[cite: 83].
 * @param {string} ruleConfig.condition - CEL string for the content condition[cite: 95].
 * @param {object} ruleConfig.action - Action object (e.g. { chromeAction: { warnUser: {} } })[cite: 163].
 * @param {string} [ruleConfig.state] - "ACTIVE" or "INACTIVE" (defaults to ACTIVE)[cite: 82].
 * @param {boolean} [validateOnly] - If true, the request is validated but not created.
 * @returns {Promise<object>} - The created policy object.
 */
export async function createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {

  // Ensure we use the client with mutation scopes (v1beta1) [cite: 12, 33]
  const client = await getPolicyClient(authToken);

  try {
    console.log(`Creating DLP Rule for customer ${customerId} in OU ${orgUnitId}...`);

    // Construct the Policy resource based on Source 44 (Request Body components)
    const request = {
      requestBody: {
        // The customer ID is required in the body for Create requests [cite: 44]
        customer: `customers/${customerId}`,

        // Target the specific Org Unit using the CEL query format [cite: 44]
        policyQuery: {
          query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
          orgUnit: `orgUnits/${orgUnitId}`
        },

        // Define the DLP Rule settings [cite: 44, 82]
        setting: {
          type: "settings/rule.dlp", // Fixed type for DLP rules
          value: {
            display_name: ruleConfig.displayName,
            description: ruleConfig.description || "",
            state: ruleConfig.state || "ACTIVE",

            // Triggers define when the rule runs (e.g. File Download) [cite: 83]
            triggers: ruleConfig.triggers,

            // Condition defines what to scan for (using CEL) [cite: 95]
            condition: {
              contentCondition: ruleConfig.condition
            },

            // Action defines what happens on match (Block, Warn, Audit) [cite: 163]
            action: ruleConfig.action
          }
        }
      }
    };

    if (validateOnly) {
      request.validateOnly = true;
    }

    const response = await callWithRetry(
      () => client.policies.create(request),
      'policies.create'
    );

    console.log(`Successfully created DLP rule: ${response.data.name}`);
    return response.data;

  } catch (error) {
    console.error(`Error creating DLP rule:`, error);
    if (error.response && error.response.data && error.response.data.error) {
      const { code, message, status } = error.response.data.error;
      let detailedMessage = `API Error ${code} (${status}): ${message}`;

      throw new Error(detailedMessage);
    }
    throw error;
  }
}

export async function createUrlList(customerId, orgUnitId, urlListConfig, authToken) {

  const client = await getPolicyClient(authToken);

  try {
    console.log(`Creating URL List for customer ${customerId} in OU ${orgUnitId}...`);

    const request = {
      requestBody: {
        customer: `customers/${customerId}`,
        policyQuery: {
          query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
          orgUnit: `orgUnits/${orgUnitId}`
        },
        setting: {
          type: "settings/detector.url_list",
          value: {
            display_name: urlListConfig.display_name,
            urlList: {
              urls: urlListConfig.urls,
            },
          },
        },
        type: "ADMIN",
      },
    };

    const response = await callWithRetry(
      () => client.policies.create(request),
      'policies.create'
    );

    console.log(`Successfully created URL list: ${response.data.name}`);
    return response.data;

  } catch (error) {
    console.error(`Error creating URL list:`, error);
    if (error.response && error.response.data && error.response.data.error) {
      const { code, message, status } = error.response.data.error;
      let detailedMessage = `API Error ${code} (${status}): ${message}`;
      throw new Error(detailedMessage);
    }
    throw error;
  }
}

export async function deleteDlpRule(policyName, authToken) {
  const client = await getPolicyClient(authToken);
  try {
    console.log(`Getting DLP policy ${policyName}...`);
    const getResponse = await callWithRetry(
      () => client.policies.get({ name: policyName }),
      'policies.get'
    );

    const policy = getResponse.data;
    const triggers = policy.setting.value.triggers;
    const chromeTriggers = [
      'google.workspace.chrome.url.v1.navigation',
      'google.workspace.chrome.file.v1.upload',
      'google.workspace.chrome.file.v1.download',
      'google.workspace.chrome.page.v1.print',
    ];

    const isChromeDlpRule = triggers.some(trigger => chromeTriggers.includes(trigger));

    if (isChromeDlpRule) {
      console.log(`Deleting DLP policy ${policyName}...`);
      const deleteResponse = await callWithRetry(
        () => client.policies.delete({ name: policyName }),
        'policies.delete'
      );
      console.log(`Successfully deleted DLP policy ${policyName}`);
      return deleteResponse.data;
    } else {
      throw new Error(`Policy ${policyName} is not a Chrome DLP rule.`);
    }
  } catch (error) {
    console.error(`Error deleting DLP policy:`, error);
    throw error;
  }
}
