/**
 * @fileoverview Prompt definition for the main '/cep' command.
 */

export const CEP_PROMPT_NAME = 'cep'

/**
 * Registers the main '/cep' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerCepPrompt = server => {
    server.registerPrompt(
        CEP_PROMPT_NAME,
        {
            description:
                'Chrome Enterprise Premium diagnostics and analysis tool. Use sub-commands for specific tasks.',
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
3. Summarize your findings and report issues by severity.

(Note: Other available commands include "/cep:maturity" and "/cep:noise".)`,
                        },
                    },
                ],
            }
        },
    )
}
