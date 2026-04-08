import { getApiClients } from './test/helpers/integration/tools/client_factory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from './tools/tools.js'

const apiClients = getApiClients()
const server = new McpServer({ name: 'test-server', version: '1.0.0' }, { capabilities: { logging: {}, prompts: {} } })

registerTools(server, { apiClients })
const req = {
  params: { name: 'get_customer_id', arguments: {} },
  method: 'tools/call',
}
server.handleRequest(req, {}).then(console.log).catch(console.error)
