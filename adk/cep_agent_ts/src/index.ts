/**
 * @fileoverview Main entry point for the CEP Agent CLI.
 */

/*
Copyright 2026 Google LLC

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

import { cepAgent, mcpClient } from './agent.js'
import * as readline from 'readline'
import 'dotenv/config'

/**
 * Main function to start the agent CLI.
 */
async function main() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
    if (!projectId) {
        console.error('[init] Error: GOOGLE_CLOUD_PROJECT environment variable is not set.')
        process.exit(1)
    }

    // Ensure connection is established (though it's lazy, we can force it here for early error)
    try {
        await mcpClient.connect()
    } catch (error) {
        console.error('[init] Failed to connect to MCP server:', error)
        process.exit(1)
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    console.log('Chrome Enterprise Premium Agent (TS)')
    console.log("Type 'exit' or 'quit' to leave.")
    console.log('------------------------------------')

    /**
     * Prompts the user for input and resolves with the answer.
     */
    const askQuestion = (query: string): Promise<string> => {
        return new Promise(resolve => rl.question(query, resolve))
    }

    /**
     * Main interaction loop.
     */
    const processInput = async () => {
        while (true) {
            const input = await askQuestion('User: ')
            if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                rl.close()
                await mcpClient.close()
                console.log('[shutdown] Exiting.')
                break
            }

            try {
                console.log('[agent] Processing...')
                const response = await cepAgent.run(input)
                console.log(`Agent: ${response}`)
            } catch (error) {
                console.error('[agent] Error running agent:', error)
            }
        }
    }

    await processInput()
}

main().catch(error => {
    console.error('[fatal] Unhandled error:', error)
    process.exit(1)
})
