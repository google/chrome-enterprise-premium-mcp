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
 * @file Tool definitions for managing BeyondCorp Secure Gateways.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { FLAGS, featureFlags } from '../../lib/util/feature_flags.js'

/**
 * Registers Secure Gateway tools with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {import('../../lib/api/beyondcorp_client.js').BeyondCorpClient} options.apiClients.beyondcorp - The BeyondCorp client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerSecureGatewayTools(server, options, sessionState) {
  const { beyondcorp } = options.apiClients || {}

  logger.debug(`${TAGS.MCP} Registering Secure Gateway tools...`)

  // 1. create_secure_gateway
  server.registerTool(
    'create_secure_gateway',
    {
      description: 'Creates a new BeyondCorp Secure Gateway in a Google Cloud project.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The unique ID for the secure gateway (e.g. "my-gateway").'),
        displayName: z.string().optional().describe('A human-readable display name for the gateway.'),
        enableServiceDiscovery: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether to enable service discovery on this gateway. Defaults to true.'),
      },
      outputSchema: z.looseObject({
        name: z.string().optional(),
        displayName: z.string().optional(),
        state: z.string().optional(),
        delegatingServiceAccount: z.string().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, displayName, enableServiceDiscovery } = params
          const gatewayConfig = {
            display_name: displayName || gatewayId,
            service_discovery: enableServiceDiscovery ? {} : undefined,
          }

          const result = await beyondcorp.createGateway(projectId, gatewayId, gatewayConfig, authToken)
          return formatToolResponse({
            summary: `Secure gateway creation initiated successfully. Use 'get_secure_gateway' to track its status and retrieve details.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 2. get_secure_gateway
  server.registerTool(
    'get_secure_gateway',
    {
      description: 'Retrieves the details and status of an existing BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
      },
      outputSchema: z.looseObject({
        name: z.string().optional(),
        displayName: z.string().optional(),
        state: z.string().optional(),
        delegatingServiceAccount: z.string().optional(),
        serviceDiscovery: z.looseObject({}).optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId } = params
          const result = await beyondcorp.getGateway(projectId, gatewayId, authToken)
          return formatToolResponse({
            summary: `Successfully retrieved details for secure gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 3. list_secure_gateways
  server.registerTool(
    'list_secure_gateways',
    {
      description: 'Lists all BeyondCorp Secure Gateways configured in a Google Cloud project.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
      },
      outputSchema: z.looseObject({
        gateways: z.array(z.looseObject({})).optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId } = params
          const gateways = await beyondcorp.listGateways(projectId, authToken)
          return formatToolResponse({
            summary: `Successfully listed secure gateways for project ${projectId}.`,
            data: { gateways },
            structuredContent: { gateways },
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 3. enable_service_discovery
  server.registerTool(
    'enable_service_discovery',
    {
      description:
        'Enables Service Discovery on an existing BeyondCorp Secure Gateway (transition from legacy PAC setup).',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
      },
      outputSchema: z.looseObject({}),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId } = params
          const result = await beyondcorp.patchGateway(
            projectId,
            gatewayId,
            { service_discovery: {} },
            'service_discovery',
            authToken,
          )
          return formatToolResponse({
            summary: `Successfully enabled Service Discovery on secure gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 4. create_secure_gateway_application
  server.registerTool(
    'create_secure_gateway_application',
    {
      description:
        'Configures routing for an application (such as a private web application) on a BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
        applicationId: z.string().describe('A unique ID for the application (e.g. "my-app").'),
        displayName: z.string().describe('A human-readable display name for the application.'),
        hostName: z.string().describe('The primary hostname users access (e.g. "private-app.local").'),
        ports: z
          .array(z.number())
          .optional()
          .default([443])
          .describe('Ports to route through the gateway. Defaults to [443].'),
        privateNetwork: z
          .string()
          .describe('The full VPC network resource name (e.g. "projects/my-project/global/networks/my-network").'),
        egressRegions: z
          .array(z.string())
          .optional()
          .describe('Google Cloud regions to align with regional static routing (e.g. ["us-central1"]).'),
      },
      outputSchema: z.looseObject({
        name: z.string().optional(),
        displayName: z.string().optional(),
        endpointMatchers: z.array(z.looseObject({})).optional(),
        upstreams: z.array(z.looseObject({})).optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, applicationId, displayName, hostName, ports, privateNetwork, egressRegions } =
            params

          const upstreamConfig = {
            network: {
              name: privateNetwork,
            },
          }
          if (egressRegions && egressRegions.length > 0) {
            upstreamConfig.egress_policy = {
              regions: egressRegions,
            }
          }

          const applicationConfig = {
            display_name: displayName,
            endpoint_matchers: [{ hostname: hostName, ports }],
            upstreams: [upstreamConfig],
          }

          const result = await beyondcorp.createApplication(
            projectId,
            gatewayId,
            applicationId,
            applicationConfig,
            authToken,
          )
          return formatToolResponse({
            summary: `Successfully configured application ${applicationId} on gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 5. get_secure_gateway_application
  server.registerTool(
    'get_secure_gateway_application',
    {
      description: 'Retrieves the details of an application configured on a BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
        applicationId: z.string().describe('The application ID.'),
      },
      outputSchema: z.looseObject({
        name: z.string().optional(),
        displayName: z.string().optional(),
        endpointMatchers: z.array(z.looseObject({})).optional(),
        upstreams: z.array(z.looseObject({})).optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, applicationId } = params
          const result = await beyondcorp.getApplication(projectId, gatewayId, applicationId, authToken)
          return formatToolResponse({
            summary: `Successfully retrieved details for application ${applicationId} on gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 5. list_secure_gateway_applications
  server.registerTool(
    'list_secure_gateway_applications',
    {
      description: 'Lists all applications configured on a BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
      },
      outputSchema: z.looseObject({
        applications: z.array(z.looseObject({})).optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId } = params
          const applications = await beyondcorp.listApplications(projectId, gatewayId, authToken)
          return formatToolResponse({
            summary: `Successfully listed applications for gateway ${gatewayId}.`,
            data: { applications },
            structuredContent: { applications },
          })
        },
      },
      options,
      sessionState,
    ),
  )

  const flags = options.featureFlags || featureFlags

  // 6. delete_secure_gateway_application
  if (flags.isEnabled(FLAGS.DELETE_TOOL_ENABLED)) {
    server.registerTool(
      'delete_secure_gateway_application',
      {
        description: 'Deletes an application routing definition from a Secure Gateway.',
        inputSchema: {
          projectId: z.string().describe('The Google Cloud project ID.'),
          gatewayId: z.string().describe('The secure gateway ID.'),
          applicationId: z.string().describe('The application ID.'),
        },
        outputSchema: z.looseObject({}),
      },
      guardedToolCall(
        {
          skipAutoResolve: true,
          handler: async (params, { authToken }) => {
            const { projectId, gatewayId, applicationId } = params
            const result = await beyondcorp.deleteApplication(projectId, gatewayId, applicationId, authToken)
            return formatToolResponse({
              summary: `Successfully deleted application ${applicationId} from gateway ${gatewayId}.`,
              data: result,
              structuredContent: result,
            })
          },
        },
        options,
        sessionState,
      ),
    )
  }

  // Common Zod schema for IAM policies, shared across set tools to ensure thorough parameter annotations.
  const policySchema = z
    .looseObject({
      bindings: z
        .array(
          z.looseObject({
            role: z
              .string()
              .describe(
                'The GCP IAM role to grant. Must be a fully-qualified role name (e.g. "roles/beyondcorp.serviceDiscoveryUser", "roles/beyondcorp.sgApplicationUser").',
              ),
            members: z
              .array(z.string())
              .describe(
                'Identities receiving the role. Each identity MUST have a prefix indicating its type (e.g. "user:alice@company.com", "group:eng@company.com", "serviceAccount:my-sa@project.iam.gserviceaccount.com"). Unprefixed emails will cause API 400 errors.',
              ),
            condition: z
              .looseObject({
                expression: z
                  .string()
                  .describe(
                    'A Common Expression Language (CEL) expression that specifies the condition (e.g. "request.time < timestamp(\\"2026-07-01T00:00:00Z\\")").',
                  ),
                title: z.string().describe('A friendly title for the condition (e.g. "Expires_July_2026").'),
                description: z.string().optional().describe('An optional human-readable description of the condition.'),
              })
              .optional()
              .describe('An optional condition that controls when the binding is applied.'),
          }),
        )
        .describe('Associates a list of members (identities) with a role.'),
      etag: z
        .string()
        .optional()
        .describe(
          'The etag identifier of the policy, used for optimistic concurrency control to prevent overwriting concurrent updates.',
        ),
      version: z.number().optional().describe('The version number of the policy schema. Typically 1 or 3.'),
    })
    .describe('The IAM policy configuration to apply.')

  // 7. get_secure_gateway_iam_policy
  server.registerTool(
    'get_secure_gateway_iam_policy',
    {
      description: 'Gets the gateway-level IAM policy for a BeyondCorp Secure Gateway (Service Discovery).',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
      },
      outputSchema: z.looseObject({
        bindings: z.array(z.looseObject({})).optional(),
        etag: z.string().optional(),
        version: z.number().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId } = params
          const result = await beyondcorp.getGatewayIamPolicy(projectId, gatewayId, authToken)
          return formatToolResponse({
            summary: `Successfully retrieved IAM policy for secure gateway ${gatewayId} (Service Discovery).`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 8. get_secure_gateway_application_iam_policy
  server.registerTool(
    'get_secure_gateway_application_iam_policy',
    {
      description: 'Gets the IAM policy for a specific Application configured on a BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
        applicationId: z.string().describe('The application ID.'),
      },
      outputSchema: z.looseObject({
        bindings: z.array(z.looseObject({})).optional(),
        etag: z.string().optional(),
        version: z.number().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, applicationId } = params
          const result = await beyondcorp.getApplicationIamPolicy(projectId, gatewayId, applicationId, authToken)
          return formatToolResponse({
            summary: `Successfully retrieved IAM policy for application ${applicationId} under gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 9. set_secure_gateway_iam_policy
  server.registerTool(
    'set_secure_gateway_iam_policy',
    {
      description: 'Sets the gateway-level IAM policy for a BeyondCorp Secure Gateway (Service Discovery).',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
        policy: policySchema,
      },
      outputSchema: z.looseObject({
        bindings: z.array(z.looseObject({})).optional(),
        etag: z.string().optional(),
        version: z.number().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, policy } = params
          const result = await beyondcorp.setGatewayIamPolicy(projectId, gatewayId, policy, authToken)
          return formatToolResponse({
            summary: `Successfully updated IAM policy for secure gateway ${gatewayId} (Service Discovery).`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )

  // 10. set_secure_gateway_application_iam_policy
  server.registerTool(
    'set_secure_gateway_application_iam_policy',
    {
      description: 'Sets the IAM policy for a specific Application configured on a BeyondCorp Secure Gateway.',
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID.'),
        gatewayId: z.string().describe('The secure gateway ID.'),
        applicationId: z.string().describe('The application ID.'),
        policy: policySchema,
      },
      outputSchema: z.looseObject({
        bindings: z.array(z.looseObject({})).optional(),
        etag: z.string().optional(),
        version: z.number().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { authToken }) => {
          const { projectId, gatewayId, applicationId, policy } = params
          const result = await beyondcorp.setApplicationIamPolicy(
            projectId,
            gatewayId,
            applicationId,
            policy,
            authToken,
          )
          return formatToolResponse({
            summary: `Successfully updated IAM policy for application ${applicationId} under gateway ${gatewayId}.`,
            data: result,
            structuredContent: result,
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
