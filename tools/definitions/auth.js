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
 * @file Tool definitions for the agent-initiated sign-in flow (`cep_auth`),
 * status checking (`cep_auth_status`), and cache clearing (`cep_auth_clear`).
 * All tools share the `cep_` prefix so an MCP client hosting multiple servers
 * (e.g. CEP plus Google Workspace) does not collide on a generic `auth_*` name.
 */

import { z } from 'zod'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { startToolAuth, completeToolAuth } from '../../lib/util/credential/auth_login.js'
import { TokenCache } from '../../lib/util/credential/token_cache.js'
import { oauthFlowCredential } from '../../lib/util/credential/oauth_flow.js'
import { resolveOAuthClientConfig } from '../../lib/util/credential/oauth_client_config.js'
import { SCOPES } from '../../lib/constants.js'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'

const TOOL_NAME = 'cep_auth'
const NPX_CLI = 'npx @google/chrome-enterprise-premium-mcp auth login'

const AGENT_HINT =
  'Show the user the authUrl and ask them to open it in a browser. After the browser is ' +
  'redirected to a 127.0.0.1 URL (the page may show "connection refused" — that is expected), ' +
  'ask the user to paste that full URL back. Then call cep_auth again with the pasted URL as ' +
  'the redirectUrl argument.'

/**
 * Builds the user-facing fallback line suggesting the CLI sign-in command.
 * For the managed OAuth client, the bare npx command is enough. For a custom
 * OAuth client, the env vars must also be exported in the shell, otherwise
 * the CLI would silently sign in under the bundled managed client.
 * @param {'managed'|'custom'} source The resolved OAuth client source.
 * @returns {string} A single line of user-facing prose.
 */
function cliFallbackLine(source) {
  if (source === 'custom') {
    return (
      "If the URL above is hard to copy or doesn't render cleanly in your client, " +
      `export CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET in your shell and run \`${NPX_CLI}\`. ` +
      'Running that caches a token this server reads on every call.'
    )
  }
  return (
    "If the URL above is hard to copy or doesn't render cleanly in your client, " +
    `you can also run \`${NPX_CLI}\` in your shell. ` +
    'Running that caches a token this server reads on every call.'
  )
}

/* OSC 8 hyperlink: ESC ] 8 ; ; URI ST text ESC ] 8 ; ; ST, where ST is ESC \. */
const OSC = '\x1b]8;;'
const ST = '\x1b\x5c'

/**
 * Detects if the current terminal environment is likely to support OSC 8 hyperlinks.
 * Checks environment variables FORCE_HYPERLINK, DOMTERM, VTE_VERSION, TERM_PROGRAM,
 * TERM, and NO_COLOR.
 * @returns {boolean} True if the terminal likely supports hyperlinks.
 */
function supportsHyperlinks() {
  if (process.env.FORCE_HYPERLINK === '1') {
    return true
  }
  if (process.env.FORCE_HYPERLINK === '0') {
    return false
  }
  if (process.env.NO_COLOR) {
    return false
  }

  const env = process.env
  if (env.DOMTERM) {
    return true
  }
  if (env.TERM_PROGRAM) {
    const program = env.TERM_PROGRAM.toLowerCase()
    if (['hyper', 'iterm.app', 'wezterm', 'vscode'].includes(program)) {
      return true
    }
  }
  if (env.TERM === 'xterm-kitty') {
    return true
  }
  if (env.VTE_VERSION) {
    const version = parseInt(env.VTE_VERSION, 10)
    if (version >= 4902) {
      return true
    }
  }
  return false
}

/**
 * Wraps a URL in OSC 8 hyperlink escapes. Modern terminals render the visible
 * text as a clickable link to the same URL; others show the URL bytes plus
 * a few stray escape chars but the URL itself remains selectable.
 * @param {string} url The URL to render as a hyperlink.
 * @param {string} [label] The visible text label. Defaults to the URL itself.
 * @returns {string} The OSC 8 wrapped URL.
 */
function osc8(url, label = url) {
  return `${OSC}${url}${ST}${label}${OSC}${ST}`
}

/**
 * Registers the authentication tools with the MCP server (alias for registerAuthTools).
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {object} sessionState - The session state object for caching.
 */
export const registerAuthTool = registerAuthTools

/**
 * Registers the authentication tools with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerAuthTools(server, options, sessionState) {
  logger.debug(`${TAGS.MCP} Registering auth tools...`)

  server.registerTool(
    TOOL_NAME,
    {
      description:
        'Sign in to Google for the Chrome Enterprise Premium (CEP) MCP server. ' +
        'Use this tool ONLY for the CEP MCP server. The Google Workspace MCP server has its own separate auth tool—do not use this one for that. ' +
        'Requests the CEP scope set: Chrome browser management, Chrome policy, Cloud Identity (DLP), Admin SDK reports, and Service Usage. ' +
        'Call with no arguments to start the sign-in. ' +
        'If the response sets `nextAction` to `paste-redirect-url`, ask the user to paste the URL the browser was redirected to, then call `cep_auth` again with that string as the `redirectUrl` argument.',
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

  server.registerTool(
    'cep_auth_status',
    {
      description:
        'Reports the current OAuth credential status and cached scopes for the Chrome Enterprise Premium (CEP) MCP server. ' +
        'Use this tool only for the CEP MCP server; the Google Workspace MCP server has its own separate status tool.',
      inputSchema: z.looseObject({}),
      outputSchema: z.looseObject({
        status: z.looseObject({}),
      }),
    },
    guardedToolCall(
      {
        handler: async () => {
          const requiredScopes = Object.values(SCOPES)
          const cred = oauthFlowCredential({ requiredScopes })
          const probe = await cred.probe()
          return formatToolResponse({
            summary: probe.ok ? 'OAuth credentials valid and active.' : 'OAuth credentials missing or incomplete.',
            data: { status: probe },
            structuredContent: { status: probe },
          })
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )

  server.registerTool(
    'cep_auth_clear',
    {
      description:
        'Clears cached OAuth credentials for the Chrome Enterprise Premium (CEP) MCP server, forcing re-authentication on the next call. ' +
        'Use this tool only for the CEP MCP server; the Google Workspace MCP server has its own separate clear tool.',
      inputSchema: z.looseObject({}),
      outputSchema: z.looseObject({
        cleared: z.boolean(),
      }),
    },
    guardedToolCall(
      {
        handler: async () => {
          const cache = new TokenCache(TokenCache.defaultPath())
          await cache.clear()
          return formatToolResponse({
            summary: 'OAuth credentials cleared.',
            data: { cleared: true },
            structuredContent: { cleared: true },
          })
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
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
  if (supportsHyperlinks()) {
    lines.push(`🔗 ${osc8(result.authUrl, 'Click here to open the Google Sign-in page in your browser')}`)
    lines.push('')
    lines.push('Or copy and paste this URL if the link above does not work:')
    lines.push('')
  }
  lines.push(result.authUrl)
  lines.push('')
  lines.push(
    "Then paste the full URL the browser was redirected to (it looks like http://127.0.0.1:PORT/?code=...&state=...; the page may show a connection error — that's expected).",
  )
  lines.push('')
  lines.push(cliFallbackLine(resolveOAuthClientConfig().source))
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
