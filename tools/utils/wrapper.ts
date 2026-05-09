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
 * @file Wrapper utilities to guard and transform MCP tool calls.
 */

import { TAGS, SCOPES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { validateAndGetOrgUnitId } from './org-unit.js'
import { isObject, getString, isApiError } from '../../lib/util/helpers.js'
import { AdminSdkClient } from '../../lib/api/admin_sdk_client.js'
import { CloudIdentityClient } from '../../lib/api/cloud_identity_client.js'
import { ChromeManagementClient } from '../../lib/api/chrome_management_client.js'
import { ChromePolicyClient } from '../../lib/api/chrome_policy_client.js'
import { ServiceUsageClient } from '../../lib/api/service_usage_client.js'
import { ApiOptions } from '../../lib/util/api-client.js'

/**
 * Generates a proactive remediation message for authentication errors.
 * @param status The HTTP status code
 * @param isOAuth Whether the CLI is running in OAuth mode
 * @returns The remediation message
 */
function getAuthRemediationMessage(status: number, isOAuth = false): string {
  if (isOAuth) {
    if (status === 401) {
      return `Authentication required. Your OAuth session has expired or is invalid. Please run \`/mcp reauth\` in your Gemini CLI to re-authenticate.`
    }
    return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate:** Run \`/mcp reauth\` in your Gemini CLI.
2. **Verify APIs are enabled:** Ensure \`admin.googleapis.com\`, \`chromemanagement.googleapis.com\`, \`chromepolicy.googleapis.com\`, and \`cloudidentity.googleapis.com\` are enabled in your Google Cloud project.`
  }

  const scopesList = Object.values(SCOPES)

  const bashScopes = scopesList.map(s => `  "${s}"`).join('\n')
  const bashCommand = `SCOPES=(\n${bashScopes}\n)\ngcloud auth application-default login --scopes=$(IFS=,; echo "\${SCOPES[*]}")`

  const pwshScopes = scopesList.map(s => `  "${s}"`).join(',\n')
  const pwshCommand = `$scopes = @(\n${pwshScopes}\n)\ngcloud auth application-default login --scopes=($scopes -join ',')`

  if (status === 401) {
    return `Authentication required. Please set up your Application Default Credentials (ADC) by running the following command in your terminal:

**For Mac/Linux (Bash/Zsh):**
\`\`\`bash
${bashCommand}
\`\`\`

**For Windows (PowerShell):**
\`\`\`powershell
${pwshCommand}
\`\`\``
  }

  return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate with all required scopes:**

   **For Mac/Linux (Bash/Zsh):**
   \`\`\`bash
   ${bashCommand}
   \`\`\`

   **For Windows (PowerShell):**
   \`\`\`powershell
   ${pwshCommand}
   \`\`\`

2. **Verify APIs are enabled:** Ensure \`admin.googleapis.com\`, \`chromemanagement.googleapis.com\`, \`chromepolicy.googleapis.com\`, and \`cloudidentity.googleapis.com\` are enabled in your Google Cloud project.`
}

/**
 * Extracts the authentication token from the request headers.
 * @param requestInfo The request context object
 * @returns The Bearer token if present, otherwise null
 */
function getAuthToken(requestInfo: unknown): string | null {
  if (isObject(requestInfo)) {
    const headers = requestInfo.headers
    if (isObject(headers)) {
      const auth = getString(headers, 'authorization')
      if (auth) {
        return auth.split(' ')[1] || null
      }
    }
  }
  return null
}

/**
 * Performs common transformations on tool parameters.
 * @param params The tool parameters to transform
 * @returns The transformed parameters
 */
export function commonTransform(params: Record<string, unknown>): Record<string, unknown> {
  const newParams = { ...params }
  const orgUnitId = getString(newParams, 'orgUnitId')
  if (orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(orgUnitId)
  }
  return newParams
}

export interface McpTextContent {
  type: 'text'
  text: string
}

export interface McpImageContent {
  type: 'image'
  data: string
  mimeType: string
}

export interface McpTextResource {
  uri: string
  text: string
  mimeType?: string
}

export interface McpBlobResource {
  uri: string
  blob: string
  mimeType?: string
}

export interface McpResourceContent {
  type: 'resource'
  resource: McpTextResource | McpBlobResource
}

export type McpContent = McpTextContent | McpImageContent | McpResourceContent

export type McpToolResponse = {
  content: McpContent[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface FormatToolResponseParams {
  summary: string
  data?: unknown
  structuredContent?: unknown
}

/**
 * Formats a tool response with a summary and a fenced JSON block.
 * @param params The response parameters
 * @param params.summary Human-readable summary (markdown)
 * @param params.data Data to be serialized in the JSON block
 * @param params.structuredContent Machine-readable content for SDK
 * @returns MCP-compatible tool response
 */
export function formatToolResponse({ summary, data, structuredContent }: FormatToolResponseParams): McpToolResponse {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: '```json\n' + JSON.stringify(data, null, 2) + '\n```' },
    ],
    structuredContent: isObject(structuredContent) ? structuredContent : undefined,
  }
}

export interface SafeFormatResponseParams {
  rawData: unknown
  formatFn: (data: unknown) => McpToolResponse
  toolName: string
}

/**
 * Wraps a formatting function with graceful degradation if it fails.
 * @param params The formatting parameters
 * @param params.rawData The raw data to format
 * @param params.formatFn Function that returns a formatToolResponse-compatible object
 * @param params.toolName Name of the tool for logging
 * @returns Formatted tool response
 */
export function safeFormatResponse({ rawData, formatFn, toolName }: SafeFormatResponseParams): McpToolResponse {
  try {
    return formatFn(rawData)
  } catch (e) {
    logger.warn(`${TAGS.MCP} ${toolName}: formatting failed, returning raw data`, e)
    return formatToolResponse({
      summary: `${toolName} completed. Raw data attached.`,
      data: rawData,
      structuredContent: rawData,
    })
  }
}

export interface ApiClients {
  adminSdk?: AdminSdkClient
  cloudIdentity?: CloudIdentityClient
  chromeManagement?: ChromeManagementClient
  chromePolicy?: ChromePolicyClient
  serviceUsage?: ServiceUsageClient
  [key: string]: unknown
}

export interface GuardedToolOptions {
  apiClients?: ApiClients
  apiOptions?: ApiOptions
  onError?: (error: unknown) => unknown
}

export interface SessionState {
  customerId: string | null
  cachedRootOrgUnitId?: string | null
  pendingRule?: Record<string, unknown> | null
  history?: unknown[]
}

export interface McpContext {
  name?: string
  requestInfo?: {
    headers?: {
      authorization?: string
    }
  }
}

export interface ToolDefinition {
  validate?: (params: Record<string, unknown>) => void
  transform?: (params: Record<string, unknown>) => Record<string, unknown>
  handler: (
    params: Record<string, unknown>,
    context: { authToken: string | null; requestInfo?: unknown; [key: string]: unknown },
  ) => Promise<McpToolResponse>
  skipAutoResolve?: boolean
}

/**
 * Helper to wrap tool handlers with common logic like customerId resolution
 * and error handling.
 * @param toolDef The tool definition object
 * @param options Configuration options for the wrapper
 * @param sessionState The session state object for caching
 * @returns The wrapped tool handler function
 */
export function guardedToolCall(
  { validate, transform, handler, skipAutoResolve = false }: ToolDefinition,
  options: GuardedToolOptions = {},
  sessionState: SessionState = { customerId: null, cachedRootOrgUnitId: null },
): (params: Record<string, unknown>, context: McpContext) => Promise<McpToolResponse> {
  return async (params: Record<string, unknown>, context: McpContext) => {
    const authToken = getAuthToken(context?.requestInfo)
    try {
      const { apiClients, apiOptions } = options
      const currentParams = { ...params }
      const pCustomerId = getString(currentParams, 'customerId')
      if (sessionState && pCustomerId) {
        sessionState.customerId = pCustomerId
      }

      if (!skipAutoResolve && currentParams.customerId === undefined) {
        if (sessionState && sessionState.customerId) {
          currentParams.customerId = sessionState.customerId
        } else {
          try {
            if (apiClients && apiClients.adminSdk && typeof apiClients.adminSdk.getCustomerId === 'function') {
              const customer = await apiClients.adminSdk.getCustomerId(authToken || '', apiOptions)
              if (customer && customer.id) {
                if (sessionState) {
                  sessionState.customerId = customer.id
                }
                currentParams.customerId = customer.id
              } else {
                logger.error(`${TAGS.MCP} Failed to auto-resolve customerId: No customer object returned.`)
              }
            } else {
              logger.error(`${TAGS.MCP} adminSdkClient not provided to guardedToolCall`)
            }
          } catch (error) {
            logger.error(`${TAGS.MCP} Failed to auto-resolve customerId:`, error)
            throw error
          }
        }
      }

      let transformedParams = commonTransform(currentParams)
      if (transform) {
        transformedParams = transform(transformedParams)
      }
      if (validate) {
        validate(transformedParams)
      }

      const result = await handler(transformedParams, { ...context, authToken })
      logger.debug(`${TAGS.MCP} Handler result for '${context?.name || 'unknown'}':`, JSON.stringify(result, null, 2))

      if (result && !result.structuredContent && result.content) {
        logger.debug(`${TAGS.MCP} Tool handler returned content without structuredContent`)
      }
      return result
    } catch (error) {
      logger.error(`${TAGS.MCP} Tool handler error for '${context?.name || 'unknown'}':`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        details: isApiError(error) ? error.response?.data || error : error,
      })

      if (options && options.onError) {
        const customErrorResponse = options.onError(error)
        if (isObject(customErrorResponse)) {
          return customErrorResponse as unknown as McpToolResponse
        }
      }

      let errorMessage = ''
      if (error instanceof Error) {
        errorMessage = error.message || ''
      }
      if (!errorMessage && isApiError(error) && error.response?.data) {
        errorMessage = JSON.stringify(error.response.data)
      }
      if (!errorMessage) {
        errorMessage = JSON.stringify(error, null, 2)
      }
      if (errorMessage === '{}' || errorMessage === '[]' || !errorMessage) {
        errorMessage = String(error)
      }

      const status =
        isObject(error) && typeof error['status'] === 'number'
          ? error['status']
          : isApiError(error)
            ? error.response?.status
            : undefined
      const isAuthError =
        status === 401 ||
        status === 403 ||
        errorMessage.includes('API Error 401') ||
        errorMessage.includes('API Error 403') ||
        errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('invalid_grant')

      if (isAuthError) {
        const resolvedStatus =
          status ||
          (errorMessage.includes('401') ||
          errorMessage.includes('UNAUTHENTICATED') ||
          errorMessage.includes('invalid_grant')
            ? 401
            : 403)
        const isOAuth = !!authToken
        const remediationMessage = getAuthRemediationMessage(resolvedStatus, isOAuth)
        return {
          content: [{ type: 'text', text: remediationMessage }],
          isError: true,
        }
      }

      if (errorMessage.includes('quota project')) {
        return {
          content: [{ type: 'text', text: `Configuration required. ${errorMessage.replace(/^Error:\s*/i, '')}` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      }
    }
  }
}
