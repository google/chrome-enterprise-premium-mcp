import { getApiClients } from './test/helpers/integration/tools/client_factory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from './tools/tools.js'

const apiClients = getApiClients()
console.log('Api clients keys:', Object.keys(apiClients))

const server = new McpServer({ name: 'test-server', version: '1.0.0' }, { capabilities: { logging: {}, prompts: {} } })

registerTools(server, { apiClients })
