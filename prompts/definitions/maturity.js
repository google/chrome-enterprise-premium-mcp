/**
 * @fileoverview Prompt definition for the '/cep:maturity' command.
 */

export const MATURITY_PROMPT_NAME = 'cep:maturity';


/**
 * Registers the '/cep:maturity' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerMaturityPrompt = (server) => {
  server.registerPrompt(
    MATURITY_PROMPT_NAME,
    {
      description: 'Assess the user\'s DLP maturity.',
      arguments: [],
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Chrome Enterprise security expert. To assess the Data Loss Prevention (DLP) maturity, follow these steps:

1. List the organizational units.
2. List the DLP rules.
3. Get the DLP events.
4. Analyze the DLP rule configuration and telemetry to determine the maturity stage.
5. Recommend next steps to improve the DLP maturity.`,
            },
          },
        ],
      };
    }
  );
};

