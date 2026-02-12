/**
 * @fileoverview Tool definition for retrieving connector policies.
 */

import { z } from 'zod';

import { getConnectorPolicy, ConnectorPolicyFilter } from '../../lib/api/chromepolicy.js';
import { gcpTool, getAuthToken, validateAndGetOrgUnitId, commonSchemas } from '../utils.js';


/**
 * Registers the 'get_connector_policy' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerGetConnectorPolicyTool(server, options) {
  server.registerTool(
    'get_connector_policy',
    {
      description: 'This tool retrieves the configuration status for Chrome Enterprise connectors, specifically distinguishing between Content Analysis settings—ON_FILE_ATTACHED, ON_FILE_DOWNLOAD, ON_BULK_TEXT_ENTRY, ON_PRINT, ON_REALTIME_URL_NAVIGATION and ON_SECURITY_EVENT. It serves as the primary diagnostic engine to verify if the settings are set for DLP rules and data insights to be operational. For accurate DLP enforcement, the model must verify that the relevant Content Analysis connector has its serviceProvider set to SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM and delayDeliveryUntilVerdict set to true. Simultaneously, the model must audit the ON_SECURITY_EVENT to ensure event telemetry is active. Specifically, if this reporting configuration uses enabledEventNames, the model must validate that the five core DLP events—contentTransferEvent, dangerousDownloadEvent, sensitiveDataEvent, urlFilteringInterstitialEvent, and suspiciousUrlEvent—are explicitly included. If these reporting events are missing or the service provider is misconfigured, the customer must be informed that while a policy may be "active," the feedback loop for DLP rules and data insights will be broken. Please provide direct links to customers to resolve this issue , this is the URL format - https://admin.google.com/ac/chrome/settings/user/details/{CONNECTOR_NAME}?ac_ouid={OrgUnitId} where CONNECTOR_NAME is file_attached, file_downloaded, bulk_text_entry, print_analysis_connector, realtime_url_check, on_security_event.',
      inputSchema: {
        customerId: commonSchemas.customerId,
        orgUnitId: commonSchemas.orgUnitId.describe('The ID of the organizational unit to filter results.'),
        policy: z
          .enum([
            'ON_FILE_ATTACHED',
            'ON_FILE_DOWNLOAD',
            'ON_BULK_TEXT_ENTRY',
            'ON_PRINT',
            'ON_REALTIME_URL_NAVIGATION',
            'ON_SECURITY_EVENT',
          ])
          .describe('The policy to filter by.'),
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId, orgUnitId, policy }, { requestInfo }) => {
        const normalizedCustomerId = customerId === 'me' ? undefined : customerId;
        const normalizedOrgUnitId = validateAndGetOrgUnitId(orgUnitId);

        if (normalizedCustomerId && typeof normalizedCustomerId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Customer ID must be a string.' }],
          };
        }
        
        if (typeof normalizedOrgUnitId !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: Org Unit ID is required.' }],
          };
        }

        try {
          const authToken = getAuthToken(requestInfo);
          const policySchemaFilter = ConnectorPolicyFilter[policy];
          
          const policies = await getConnectorPolicy(
            normalizedCustomerId,
            normalizedOrgUnitId,
            policySchemaFilter,
            null, // progressCallback
            authToken
          );

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