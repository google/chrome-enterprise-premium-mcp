/**
 * @fileoverview Tool definition for analyzing Chrome activity logs.
 */

import { z } from 'zod';

import { listChromeActivities } from '../../lib/api/admin_sdk.js';
import { guardedToolCall, getAuthToken } from '../utils.js';

/**
 * Registers the 'analyze_chrome_logs_for_risky_activity' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerAnalyzeChromeLogsTool(server, options) {
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
        customerId: z
          .string()
          .optional()
          .describe('The customer ID to filter by. Defaults to the current customer.'),
      },
    },
    guardedToolCall({
      handler: async ({ userKey, startTime, endTime, customerId }, { requestInfo }) => {
        const authToken = getAuthToken(requestInfo);

        const activities = await listChromeActivities({
          userKey,
          startTime,
          endTime,
          customerId,
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
              text: JSON.stringify(activities),
            },
          ],
        };
      }
    })
  );
}