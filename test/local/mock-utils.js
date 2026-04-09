import esmock from 'esmock'

/**
 * Helper to set up a tool handler with a mocked Cloud Identity client.
 *
 * @param {Object} server - The mock server object containing a `registerTool` mock.
 * @param {string} toolName - The name of the tool to retrieve the handler for.
 * @param {Object} clientMethods - An object containing mock methods for the client.
 * @returns {Function} The tool handler.
 */
export async function setupCloudIdentityHandler(server, toolName, clientMethods) {
  const MockCloudIdentityClient = class {
    constructor() {
      Object.assign(this, clientMethods)
    }
  }

  const { registerTools } = await esmock(
    '../../tools/index.js',
    {},
    {
      '../../lib/api/real_cloud_identity_client.js': {
        RealCloudIdentityClient: MockCloudIdentityClient,
      },
    },
  )

  registerTools(server, {
    gcpCredentialsAvailable: true,
    apiClients: { cloudIdentity: new MockCloudIdentityClient() },
  })

  return server.registerTool.mock.calls.find(call => call.arguments[0] === toolName).arguments[2]
}
