/**
 * @fileoverview Tool definition for creating DLP rules.
 */

import { z } from 'zod';

import { createDlpRule } from '../../lib/api/cloudidentity.js';
import { guardedToolCall, getAuthToken, validateAndGetOrgUnitId, commonSchemas } from '../utils.js';

const TRIGGER_MAPPING = {
  FILE_UPLOAD: 'google.workspace.chrome.file.v1.upload',
  FILE_DOWNLOAD: 'google.workspace.chrome.file.v1.download',
  WEB_CONTENT_UPLOAD: 'google.workspace.chrome.web_content.v1.upload',
  PRINT: 'google.workspace.chrome.page.v1.print',
  NAVIGATION: 'google.workspace.chrome.url.v1.navigation',
};

const ACTION_TYPES = {
  BLOCK: 'BLOCK',
  WARN: 'WARN',
  AUDIT: 'AUDIT',
};


/**
 * Registers the 'create_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerCreateDlpRuleTool(server, options) {
  server.registerTool(
    'create_dlp_rule',
    {
      description: 'Creates a new Chrome DLP rule for a specific Organizational Unit. Supports a validate_only mode to test rule creation without saving the rule.',
      inputSchema: {
        customerId: commonSchemas.customerId,
        orgUnitId: commonSchemas.orgUnitId.describe('The target Organizational Unit ID'),
        displayName: z.string().describe('Name of the rule'),
        description: z.string().optional().describe('Description of the rule'),
        triggers: z.array(z.enum(Object.keys(TRIGGER_MAPPING))).describe('List of simplified triggers.'),
        condition: z.string().describe('CEL condition string (e.g. "all_content.contains(\'confidential\')")'),
        action: z.enum([ACTION_TYPES.BLOCK, ACTION_TYPES.WARN, ACTION_TYPES.AUDIT]).describe('Action to take when the rule is triggered'),
        state: z.enum(['ACTIVE', 'INACTIVE']).optional().describe('Rule state (defaults to ACTIVE)'),
        validateOnly: z.boolean().optional().describe('If true, the request is validated but not created.'),
        customMessage: z.string().optional().describe('Custom message to display to the user when the rule is triggered.'),
        watermarkMessage: z.string().optional().describe('Watermark message to display when the rule is triggered.'),
        blockScreenshot: z.boolean().optional().describe('Whether to block screenshots when the rule is triggered.'),
        saveContent: z.boolean().optional().describe('Whether to save the content that triggered the rule.'),
      },
    },

    guardedToolCall({
      transform: (params) => {
        const newDisplayName = `🤖 ${params.displayName}`;
        return { ...params, displayName: newDisplayName };
      },
      validate: (params) => {
        if (params.action === ACTION_TYPES.BLOCK) {
          throw new Error('Creating DLP rules in "BLOCK" mode is not permitted. Supported actions are "AUDIT" and "WARN".');
        }
        return true;
      },
      handler: async (params, { requestInfo }) => {
        const {
          customerId,
          orgUnitId,
          displayName,
          description,
          triggers,
          condition,
          action,
          state,
          validateOnly,
          customMessage,
          watermarkMessage,
          blockScreenshot,
          saveContent
        } = params;

        const authToken = getAuthToken(requestInfo);
        const fullTriggers = triggers.map(t => TRIGGER_MAPPING[t]);
        
        const ruleConfig = {
          displayName,
          description,
          triggers: fullTriggers,
          condition,
          state
        };

        const actionParams = {};
        if (customMessage) actionParams.customEndUserMessage = { unsafeHtmlMessageBody: customMessage };
        if (watermarkMessage) actionParams.watermarkMessage = watermarkMessage;
        if (blockScreenshot) actionParams.blockScreenshot = blockScreenshot;
        if (saveContent) actionParams.saveContent = saveContent;

        switch (action) {
          case ACTION_TYPES.BLOCK:
            ruleConfig.action = { chromeAction: { blockContent: {} } };
            if (Object.keys(actionParams).length > 0) {
              ruleConfig.action.chromeAction.blockContent.actionParams = actionParams;
            }
            break;
          case ACTION_TYPES.WARN:
            ruleConfig.action = { chromeAction: { warnUser: {} } };
            if (Object.keys(actionParams).length > 0) {
              ruleConfig.action.chromeAction.warnUser.actionParams = actionParams;
            }
            break;
          case ACTION_TYPES.AUDIT:
            ruleConfig.action = { chromeAction: { auditOnly: {} } };
            break;
        }

        const createdPolicy = await createDlpRule(
          customerId, 
          orgUnitId, 
          ruleConfig, 
          validateOnly, 
          authToken
        );

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
      }
    })
  );
}
