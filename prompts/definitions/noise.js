/**
 * @fileoverview Prompt definition for the '/cep:noise' command.
 */

export const NOISE_PROMPT_NAME = 'cep:noise'

/**
 * Registers the '/cep:noise' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerNoisePrompt = server => {
    server.registerPrompt(
        NOISE_PROMPT_NAME,
        {
            description: "Analyze the user's DLP rule noise.",
            arguments: [],
        },
        async () => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `You are a Chrome Enterprise security expert. To analyze the Data Loss Prevention (DLP) rule noise, follow these steps:

1. List the DLP rules.
2. Get the DLP events.
3. Identify DLP rules with high false positive rates or override rates.
4. Recommend optimization actions to reduce rule noise.`,
                        },
                    },
                ],
            }
        },
    )
}
