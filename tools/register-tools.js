/*
Copyright 2025 Google LLC

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

import { z } from 'zod';
import { countBrowserVersions, listCustomerProfiles } from '../lib/api/chromemanagement.js';
import { listDlpPolicies, createDlpRule, deleteDlpRule, createUrlList } from '../lib/api/cloudidentity.js';
import { getConnectorPolicy, ConnectorPolicyFilter } from '../lib/api/chromepolicy.js';
import { listChromeActivities, listOrgUnits, getCustomerId } from '../lib/api/admin_sdk.js';

function getAuthToken(requestInfo) {
  return requestInfo?.headers?.authorization ? requestInfo.headers.authorization.split(' ')[1] : null;
}

function gcpTool(gcpCredentialsAvailable, fn) {
  return fn;
}

function validateAndGetOrgUnitId(orgUnitId) {
  if (typeof orgUnitId === 'string' && orgUnitId.startsWith('id:')) {
    return orgUnitId.substring(3);
  }
  return orgUnitId;
}

// Tool to count Chrome browser versions
function registerCountBrowserVersionsTool(server, options) {
  server.registerTool(
    'count_browser_versions',
    {
      description: 'Counts Chrome browser versions reported by devices.',
      inputSchema: {
        customerId: z
          .string()
          .optional()
          .describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z
          .string()
          .optional()
          .describe('The ID of the organizational unit to filter results.'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId, orgUnitId }) => {
        if (customerId === 'me') {
          customerId = undefined;
        }
        orgUnitId = validateAndGetOrgUnitId(orgUnitId);
        if (customerId && typeof customerId !== 'string') {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Customer ID must be a string.',
              },
            ],
          };
        }
        try {
          const versions = await countBrowserVersions(
            customerId,
            orgUnitId
          );
          if (!versions || versions.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No browser versions found for customer ${customerId}.`,
                },
              ],
            };
          }
          const versionList = versions
            .map(
              (v) =>
                `- ${v.version} (${v.count} devices) - ${v.releaseChannel}`
            )
            .join('\n');
          return {
            content: [
              {
                type: 'text',
                text: `Browser versions for customer ${customerId}:\n${versionList}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error counting browser versions: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to count Chrome browser versions
function registerCustomerProfileTool(server, options) {
  server.registerTool(
    'list_customer_profiles',
    {
      description: 'Lists all customer profiles for a given customer.',
      inputSchema: {
        customerId: z
          .string()
          .optional()
          .describe('The Chrome customer ID (e.g. C012345)')
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId }) => {
        if (customerId === 'me') {
          customerId = undefined;
        }
        if (customerId && typeof customerId !== 'string') {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Customer ID must be a string.',
              },
            ],
          };
        }
        try {
          const profiles = await listCustomerProfiles(
            customerId
          );
          if (!profiles || profiles.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No profiles found for customer ${customerId}.`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `Browser versions for customer ${customerId}:\n${JSON.stringify(profiles)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing customer profiles: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to list DLP rules (and optionally detectors)
function registerListDlpRulesTool(server, options) {
  const supportedTriggers = [
    "google.workspace.chrome.file.v1.upload",
    "google.workspace.chrome.file.v1.download",
    "google.workspace.chrome.web_content.v1.upload",
    "google.workspace.chrome.page.v1.print",
    "google.workspace.chrome.url.v1.navigation"
  ];

  server.registerTool(
    'list_dlp_rules',
    {
      description: 'Lists all DLP rules or detectors for a given customer. The tool returns rules with multiple attributes, parse them and return names, summarize the action',
      inputSchema: {
        type: z
          .enum(['rule', 'detector'])
          .optional()
          .describe('Filter by policy type. Defaults to "rule". Set to "detector" to list detectors.')
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({type}, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          // Default to 'rule' if not specified, since the tool name implies rules
          const policyType = type || 'rule';

          const policies = await listDlpPolicies(
            policyType,
            authToken
          );

          const filteredPolicies = policies.filter(policy => {
            if (policy.setting && policy.setting.value && policy.setting.value.triggers) {
                return policy.setting.value.triggers.some(trigger => supportedTriggers.includes(trigger));
            }
            return false;
          });

          if (!filteredPolicies || filteredPolicies.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No DLP ${policyType}s found with supported triggers.`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `DLP ${policyType}:\n${JSON.stringify(filteredPolicies, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing DLP policies: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// Tool to create a new DLP rule
function registerCreateDlpRuleTool(server, options) {
  const triggerMapping = {
    FILE_UPLOAD: "google.workspace.chrome.file.v1.upload",
    FILE_DOWNLOAD: "google.workspace.chrome.file.v1.download",
    WEB_CONTENT_UPLOAD: "google.workspace.chrome.web_content.v1.upload",
    PRINT: "google.workspace.chrome.page.v1.print",
    NAVIGATION: "google.workspace.chrome.url.v1.navigation"
  };

  server.registerTool(
    'create_dlp_rule',
    {
      description: 'Creates a new Chrome DLP rule for a specific Organizational Unit. Supports a validate_only mode to test rule creation without saving the rule.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z.string().describe('The target Organizational Unit ID'),
        displayName: z.string().describe('Name of the rule'),
        description: z.string().optional().describe('Description of the rule'),
        triggers: z.array(z.enum(Object.keys(triggerMapping))).describe('List of simplified triggers.'),
        condition: z.string().describe('CEL condition string (e.g. "all_content.contains(\'confidential\')")'),
        action: z.enum(['BLOCK', 'WARN', 'AUDIT']).describe('Action to take when the rule is triggered'),
        state: z.enum(['ACTIVE', 'INACTIVE']).optional().describe('Rule state (defaults to ACTIVE)'),
        validateOnly: z.boolean().optional().describe('If true, the request is validated but not created.'),
        customMessage: z.string().optional().describe('Custom message to display to the user when the rule is triggered.'),
        watermarkMessage: z.string().optional().describe('Watermark message to display when the rule is triggered.'),
        blockScreenshot: z.boolean().optional().describe('Whether to block screenshots when the rule is triggered.'),
        saveContent: z.boolean().optional().describe('Whether to save the content that triggered the rule.'),
      },
    },

    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId, orgUnitId, displayName, description, triggers, condition, action, state, validateOnly, customMessage, watermarkMessage, blockScreenshot, saveContent }, { requestInfo }) => {
        if (customerId === 'me') {
          customerId = undefined;
        }
        orgUnitId = validateAndGetOrgUnitId(orgUnitId);
        if (customerId && typeof customerId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Customer ID must be a string.' }],
          };
        }
        if (typeof orgUnitId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Org Unit ID is required.' }],
          };
        }

        try {
          const authToken = getAuthToken(requestInfo);
          const fullTriggers = triggers.map(t => triggerMapping[t]);
          const ruleConfig = {
            displayName,
            description,
            triggers: fullTriggers,
            condition,
            state
          };

          const actionParams = {};
          if (customMessage) {
            actionParams.customEndUserMessage = { unsafeHtmlMessageBody: customMessage };
          }
          if (watermarkMessage) {
            actionParams.watermarkMessage = watermarkMessage;
          }
          if (blockScreenshot) {
            actionParams.blockScreenshot = blockScreenshot;
          }
          if (saveContent) {
            actionParams.saveContent = saveContent;
          }

          switch (action) {
            case 'BLOCK':
              ruleConfig.action = { chromeAction: { blockContent: {} } };
              if (Object.keys(actionParams).length > 0) {
                ruleConfig.action.chromeAction.blockContent.actionParams = actionParams;
              }
              break;
            case 'WARN':
              ruleConfig.action = { chromeAction: { warnUser: {} } };
              if (Object.keys(actionParams).length > 0) {
                ruleConfig.action.chromeAction.warnUser.actionParams = actionParams;
              }
              break;
            case 'AUDIT':
              ruleConfig.action = { chromeAction: { auditOnly: {} } };
              break;
          }

          const createdPolicy = await createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly, authToken);

          if (validateOnly) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'DLP rule validation successful. The rule was not created.',
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created DLP rule: ${createdPolicy.name}\n\nDetails:\n${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating DLP rule: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerGetChromeActivityLogTool(server, options) {
  server.registerTool(
    'get_chrome_activity_log',
    {
      description: 'Gets a log of Chrome browser activity for a given user. By default, it retrieves events from the last 10 days unless a specific start time is provided. Do not prompt users for additional inputs; use the defaults if no values are provided.',
      inputSchema: {
        userKey: z
          .string()
          .describe('The user key to get activities for. Use "all" for all users.')
          .default('all'),
        eventName: z
          .string()
          .optional()
          .describe('The name of the event to filter by.'),
        startTime: z
          .string()
          .optional()
          .describe('The start time of the range to get activities for (RFC3339 timestamp). Defaults to 10 days ago if not specified.'),
        endTime: z
          .string()
          .optional()
          .describe('The end time of the range to get activities for (RFC3339 timestamp). Defaults to now.'),
        maxResults: z
          .number()
          .optional()
          .describe('The maximum number of results to return.'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ userKey, eventName, startTime, endTime, maxResults }, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          if (!startTime) {
            const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
            startTime = tenDaysAgo.toISOString();
          }
          if (!endTime) {
            endTime = new Date().toISOString();
          }
          const activities = await listChromeActivities({
            userKey,
            eventName,
            startTime,
            endTime,
            maxResults,
          }, authToken);
          if (!activities || activities.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No Chrome activity found for the specified criteria.',
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `Chrome activity:\n${JSON.stringify(activities, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting Chrome activity: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerAnalyzeChromeLogsTool(server, options) {
  server.registerTool(
    'analyze_chrome_logs_for_risky_activity',
    {
      description: 'Analyzes Chrome activity logs for risky behavior.',
      inputSchema: {
        userKey: z
          .string()
          .describe('The user key to get activities for. Use "all" for all users.')
          .default('all'),
        startTime: z
          .string()
          .optional()
          .describe('The start time of the range to get activities for (RFC3339 timestamp).'),
        endTime: z
          .string()
          .optional()
          .describe('The end time of the range to get activities for (RFC3339 timestamp).'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ userKey, startTime, endTime }, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          const activities = await listChromeActivities({
            userKey,
            startTime,
            endTime,
          }, authToken);
          if (!activities || activities.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No Chrome activity found for the specified criteria.',
                },
              ],
            };
          }
          return activities
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing Chrome activity: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

// TODO: Verify if DLP rule is a chrome rule
function registerDeleteDlpRuleTool(server, options) {
  server.registerTool(
    'delete_dlp_rule',
    {
      description: 'Deletes a Chrome DLP rule.',
      inputSchema: {
        policyName: z.string().describe('The name of the policy to delete (e.g. policies/akajj264aovytg7aau)'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ policyName }, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          const result = await deleteDlpRule(policyName, authToken);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted DLP rule: ${policyName}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error deleting DLP rule: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerCreateUrlListTool(server, options) {
  server.registerTool(
    'create_url_list',
    {
      description: 'Creates a new URL list.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z.string().describe('The ID of the organizational unit to filter results.'),
        displayName: z.string().describe('The display name for the URL list.'),
        urls: z.array(z.string()).describe('A list of URLs to include in the list.'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId, orgUnitId, displayName, urls }, { requestInfo }) => {
        if (customerId === 'me') {
          customerId = undefined;
        }
        orgUnitId = validateAndGetOrgUnitId(orgUnitId);
        if (customerId && typeof customerId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Customer ID must be a string.' }],
          };
        }
        if (typeof orgUnitId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Org Unit ID is required.' }],
          };
        }

        try {
          const authToken = getAuthToken(requestInfo);
          const urlListConfig = {
            display_name: displayName,
            urls: urls,
          };

          const createdPolicy = await createUrlList(customerId, orgUnitId, urlListConfig, authToken);

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created URL list: ${createdPolicy.name}\n\nDetails:\n${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating URL list: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerGetConnectorPolicyTool(server, options) {
  server.registerTool(
    'get_connector_policy',
    {
      description: 'This tool retrieves the configuration status for Chrome Enterprise connectors, specifically distinguishing between Content Analysis settings—ON_FILE_ATTACHED, ON_FILE_DOWNLOAD, ON_BULK_TEXT_ENTRY, ON_PRINT, ON_REALTIME_URL_NAVIGATION and ON_SECURITY_EVENT. It serves as the primary diagnostic engine to verify if the settings are set for DLP rules and data insights to be operational. For accurate DLP enforcement, the model must verify that the relevant Content Analysis connector has its serviceProvider set to SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM and delayDeliveryUntilVerdict set to true. Simultaneously, the model must audit the ON_SECURITY_EVENT to ensure event telemetry is active. Specifically, if this reporting configuration uses enabledEventNames, the model must validate that the five core DLP events—contentTransferEvent, dangerousDownloadEvent, sensitiveDataEvent, urlFilteringInterstitialEvent, and suspiciousUrlEvent—are explicitly included. If these reporting events are missing or the service provider is misconfigured, the customer must be informed that while a policy may be "active," the feedback loop for DLP rules and data insights will be broken. Please provide direct links to customers to resolve this issue , this is the URL format - https://admin.google.com/ac/chrome/settings/user/details/{CONNECTOR_NAME}?ac_ouid={OrgUnitId} where CONNECTOR_NAME is file_attached, file_downloaded, bulk_text_entry, print_analysis_connector, realtime_url_check, on_security_event.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z.string().describe('The ID of the organizational unit to filter results.'),
        policy: z.enum(['ON_FILE_ATTACHED', 'ON_FILE_DOWNLOAD', 'ON_BULK_TEXT_ENTRY', 'ON_PRINT', 'ON_REALTIME_URL_NAVIGATION', 'ON_SECURITY_EVENT']).describe('The policy to filter by.'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId, orgUnitId, policy }, { requestInfo }) => {
        if (customerId === 'me') {
          customerId = undefined;
        }
        orgUnitId = validateAndGetOrgUnitId(orgUnitId);
        if (customerId && typeof customerId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Customer ID must be a string.' }],
          };
        }
        if (typeof orgUnitId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Org Unit ID is required.' }],
          };
        }

        try {
          const authToken = getAuthToken(requestInfo);
          const policySchemaFilter = ConnectorPolicyFilter[policy];
          const policies = await getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, authToken);

          return {
            content: [
              {
                type: 'text',
                text: `Connector policy:\n${JSON.stringify(policies, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting connector policy: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerListOrgUnitsTool(server, options) {
  server.registerTool(
    'list_org_units',
    {
      description: 'Lists all organizational units for a given customer. This tool should be used whenever another tool requires an org unit ID. It provides users with a list of organizational unit names, so they do not need to manually search for the org unit ID.',
      inputSchema: {},
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({}, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          const orgUnits = await listOrgUnits({}, authToken);
          if (!orgUnits || orgUnits.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No organizational units found for the specified criteria.',
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `Organizational Units:\n${JSON.stringify(orgUnits, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing organizational units: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

function registerGetCustomerIdTool(server, options) {
  server.registerTool(
    'get_customer_id',
    {
      description: 'Gets the customer ID for the authenticated user. All other tools that require a customer ID should get it using this tool instead of asking the user for it.',
      inputSchema: {},
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({}, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          const customer = await getCustomerId(authToken);
          if (!customer) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Could not retrieve customer ID.',
                },
              ],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `Customer ID: ${customer.id}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting customer ID: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}

export { registerCountBrowserVersionsTool, registerCustomerProfileTool, registerListDlpRulesTool, registerCreateDlpRuleTool, registerGetChromeActivityLogTool, registerAnalyzeChromeLogsTool, registerDeleteDlpRuleTool, registerCreateUrlListTool, registerGetConnectorPolicyTool, registerListOrgUnitsTool, registerGetCustomerIdTool };