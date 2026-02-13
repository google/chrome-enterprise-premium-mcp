/**
 * @fileoverview Tool definition for deleting DLP rules.
 */

import { z } from 'zod';

import { deleteDlpRule } from '../../lib/api/cloudidentity.js';
import { guardedToolCall, getAuthToken } from '../utils.js';


/**
 * Registers the 'delete_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerDeleteDlpRuleTool(server, options) {
  server.registerTool(
    'delete_dlp_rule',
    {
      description: 'Deletes a Chrome DLP rule.',
      inputSchema: {
        policyName: z.string().describe('The name of the policy to delete (e.g. policies/akajj264aovytg7aau)'),
      },
    },
    guardedToolCall({
      handler: async ({ policyName }, { requestInfo }) => {
        const authToken = getAuthToken(requestInfo);
        await deleteDlpRule(policyName, authToken);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully deleted DLP rule: ${policyName}`,
            },
          ],
        };
      }
    })
  );
}