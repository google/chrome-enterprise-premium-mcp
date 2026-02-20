/**
 * @fileoverview Prompt definition for the '/cep:diagnose' command.
 */

export const DIAGNOSE_PROMPT_NAME = 'cep:diagnose'

/**
 * Registers the '/cep:diagnose' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerDiagnosePrompt = server => {
  server.registerPrompt(
    DIAGNOSE_PROMPT_NAME,
    {
      description: "Run a health check on the user's environment.",
      arguments: [],
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Chrome Enterprise security expert. To run a health check on the user's environment, follow these steps:

1. List the organizational units.
2. For each organizational unit, verify these settings:
    *   Is Chrome Browser Cloud Management (CBCM) enrollment active?
    *   Do browsers report to the admin console?
    *   Is the Chrome browser version current?
    *   Is an active Chrome Enterprise Premium license assigned?
    *   Are security connectors set to **Chrome Enterprise Premium**?
    *   Is **Delay file upload** configured for enforcement?
    *   Is **Enhanced Safe Browsing** enabled?
    *   Are Data Loss Prevention (DLP) rules enabled?
    *   Is reporting enabled for DLP events?
3. Summarize your findings and report issues by severity.`,
            },
          },
        ],
      }
    },
  )
}
