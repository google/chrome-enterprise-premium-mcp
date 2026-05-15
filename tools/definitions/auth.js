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

/**
 * @file Tool definition for the agent-initiated sign-in flow (`cep_auth`).
 *
 * Not wrapped with `guardedToolCall` — that wrapper performs the auth
 * pre-flight check and would refuse to invoke this tool when the cache is
 * empty, which is exactly when this tool is needed.
 */

import { z } from 'zod'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { startToolAuth, completeToolAuth } from '../../lib/util/credential/auth_login.js'

const TOOL_NAME = 'cep_auth'

const AGENT_HINT =
  'Show the user the authUrl and ask them to open it in a browser. After the browser is ' +
  'redirected to a 127.0.0.1 URL (the page may show "connection refused" — that is expected), ' +
  'ask the user to paste that full URL back. Then call cep_auth again with the pasted URL as ' +
  'the redirectUrl argument.'

/**
 * Registers the `cep_auth` tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server The MCP server instance.
 */
export function registerAuthTool(server) {
  logger.debug(`${TAGS.MCP} Registering '${TOOL_NAME}' tool...`)
  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Sign in to Google so the server can call the Workspace APIs. Call with no arguments to start. ' +
        'If the response says nextAction is "paste-redirect-url", ask the user to paste the URL the ' +
        'browser was redirected to, then call cep_auth again with that string as the redirectUrl argument.',
      inputSchema: {
        redirectUrl: z
          .string()
          .optional()
          .describe(
            'The full URL the browser was redirected to after consent (looks like http://127.0.0.1:PORT/?code=...&state=...). Omit to start a fresh sign-in.',
          ),
      },
      outputSchema: z.looseObject({
        status: z.enum(['completed', 'awaiting', 'error']),
        authUrl: z.string().optional(),
        nextAction: z.string().optional(),
        message: z.string().optional(),
        expiresAt: z.string().optional(),
      }),
    },
    async ({ redirectUrl }, context) => {
      if (context?.requestInfo?.headers?.authorization) {
        const msg =
          'This server received an inbound Bearer token, so sign-in via cep_auth does not apply. ' +
          'Refresh the Bearer token through your MCP client.'
        return {
          content: [{ type: 'text', text: msg }],
          structuredContent: { status: 'error', code: 'BEARER_INBOUND', message: msg },
          isError: true,
        }
      }
      try {
        if (redirectUrl !== undefined && redirectUrl !== '') {
          const result = await completeToolAuth({ redirectUrl })
          return successResponse(result)
        }
        const result = await startToolAuth({})
        if (result.status === 'completed') {
          return successResponse(result)
        }
        return awaitingResponse(result)
      } catch (err) {
        logger.error(`${TAGS.MCP} cep_auth failed:`, err?.message || err)
        const message = err?.message || String(err)
        return {
          content: [{ type: 'text', text: `Sign-in failed: ${message}` }],
          structuredContent: { status: 'error', code: err?.code, message },
          isError: true,
        }
      }
    },
  )
}

/**
 * Builds the "you're signed in" response.
 * @param {{expiresAt?: Date|null, source?: string}} result The completed-auth result.
 * @returns {object} MCP tool response with status=completed.
 */
function successResponse(result) {
  const expiresAt = result.expiresAt instanceof Date ? result.expiresAt.toISOString() : null
  const tail = expiresAt ? ` Token expires at ${expiresAt}.` : ''
  return {
    content: [{ type: 'text', text: `Signed in.${tail}` }],
    structuredContent: { status: 'completed', expiresAt: expiresAt ?? undefined, source: result.source },
  }
}

/**
 * Builds the "waiting on the user to paste the URL back" response.
 * @param {{authUrl: string, browserOpened: boolean, browserAttempted: boolean, expiresAt?: Date|null, source?: string}} result The awaiting-auth result.
 * @returns {object} MCP tool response with status=awaiting and nextAction=paste-redirect-url.
 */
function awaitingResponse(result) {
  const lines = []
  if (result.browserOpened) {
    lines.push('A browser tab should have opened for sign-in.')
    lines.push(
      "Once the browser is redirected to a 127.0.0.1 URL (the page may show a connection error — that's fine), paste that full URL back so the sign-in can complete.",
    )
    lines.push('')
    lines.push('If the browser did not open, the consent URL is:')
  } else {
    lines.push('Open this URL in a browser and complete sign-in:')
  }
  lines.push('')
  lines.push(result.authUrl)
  lines.push('')
  lines.push(
    "Then paste the full URL the browser was redirected to (it looks like http://127.0.0.1:PORT/?code=...&state=...; the page may show a connection error — that's expected).",
  )
  const expiresAt = result.expiresAt instanceof Date ? result.expiresAt.toISOString() : undefined
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    structuredContent: {
      status: 'awaiting',
      authUrl: result.authUrl,
      nextAction: 'paste-redirect-url',
      browserAttempted: result.browserAttempted,
      browserOpened: result.browserOpened,
      expiresAt,
      source: result.source,
      agentHint: AGENT_HINT,
    },
  }
}
