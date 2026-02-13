/**
 * @fileoverview Tool definition for counting browser versions.
 */

import { countBrowserVersions } from '../../lib/api/chromemanagement.js';
import { guardedToolCall, validateAndGetOrgUnitId, commonSchemas } from '../utils.js';


/**
 * Registers the 'count_browser_versions' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerCountBrowserVersionsTool(server, options) {
  server.registerTool(
    'count_browser_versions',
    {
      description: 'Counts Chrome browser versions reported by devices.',
      inputSchema: {
        customerId: commonSchemas.customerId,
        orgUnitId: commonSchemas.orgUnitIdOptional,
      },
    },
    guardedToolCall({
      handler: async ({ customerId, orgUnitId }) => {
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
      }
    })
  );
}
