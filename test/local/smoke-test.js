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

/* eslint-disable n/no-process-exit */

process.env.GCP_STDIO ??= 'false'

import { spawn } from 'child_process'
import http from 'http'

const server = spawn('node', ['mcp-server.js'], {
  env: { ...process.env, GOOGLE_API_ROOT_URL: 'http://localhost:1234' },
})

function runToolTest() {
  const postData =
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1,
    }) + '\n'

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(postData),
    },
  }

  const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)
    console.log('headers:', res.headers)

    let responseBody = ''
    res.on('data', chunk => {
      responseBody += chunk
    })

    res.on('end', () => {
      console.log('responseBody:', responseBody)
      if (res.statusCode === 200 && responseBody.includes('"name":"get_customer_id"')) {
        console.log('Tool smoke test passed!')
        runPromptTest()
      } else {
        console.error('Tool smoke test failed')
        server.kill()
        process.exit(1)
      }
    })
  })

  req.on('error', error => {
    console.error('Tool smoke test failed:', error)
    server.kill()
    process.exit(1)
  })

  req.write(postData)
  req.end()
}

function runPromptTest() {
  const postData =
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'prompts/list',
      params: {},
      id: 1,
    }) + '\n'

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(postData),
    },
  }

  const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)
    console.log('headers:', res.headers)

    let responseBody = ''
    res.on('data', chunk => {
      responseBody += chunk
    })

    res.on('end', () => {
      console.log('responseBody:', responseBody)
      if (res.statusCode === 200 && responseBody.includes('"name":"cep:diagnose"')) {
        console.log('Prompt smoke test passed!')
        server.kill()
        runOAuthTest()
      } else {
        console.error('Prompt smoke test failed')
        server.kill()
        process.exit(1)
      }
    })
  })

  req.on('error', error => {
    console.error('Prompt smoke test failed:', error)
    server.kill()
    process.exit(1)
  })

  req.write(postData)
  req.end()
}

function runOAuthTest() {
  console.log('--- Starting OAuth Smoke Test ---')
  const oauthServer = spawn('node', ['mcp-server.js'], {
    env: {
      ...process.env,
      GOOGLE_API_ROOT_URL: 'http://localhost:1234',
      OAUTH_ENABLED: 'true',
      PORT: '3001',
    },
  })

  oauthServer.stdout.on('data', data => {
    console.log(`oauth-server: ${data}`)
    if (data.includes('Chrome Enterprise Premium MCP server listening on port')) {
      executeUnauthorizedCall()
    }
  })

  oauthServer.stderr.on('data', data => {
    console.error(`oauth-server error: ${data}`)
  })

  function executeUnauthorizedCall() {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'get_customer_id', arguments: {} },
      id: 1,
    })

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, res => {
      console.log(`OAuth test statusCode: ${res.statusCode}`)
      let body = ''
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => {
        console.log('OAuth test responseBody (no token):', body)
        if (res.statusCode === 401 && body.includes('Authentication required')) {
          console.log('OAuth unauthorized (no token) test passed!')
          executeInvalidTokenCall()
        } else {
          console.error('OAuth unauthorized (no token) test failed')
          oauthServer.kill()
          process.exit(1)
        }
      })
    })

    req.on('error', e => {
      console.error('OAuth test request error:', e)
      oauthServer.kill()
      process.exit(1)
    })

    req.write(postData)
    req.end()
  }

  function executeInvalidTokenCall() {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'get_customer_id', arguments: {} },
      id: 2,
    })

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer invalid-token',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, res => {
      console.log(`OAuth invalid token statusCode: ${res.statusCode}`)
      let body = ''
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => {
        console.log('OAuth invalid token responseBody:', body)
        if (res.statusCode === 401 && body.includes('Invalid or expired token')) {
          console.log('OAuth invalid token test passed!')
          oauthServer.kill()
          process.exit(0)
        } else {
          console.error('OAuth invalid token test failed')
          oauthServer.kill()
          process.exit(1)
        }
      })
    })

    req.on('error', e => {
      console.error('OAuth invalid token test request error:', e)
      oauthServer.kill()
      process.exit(1)
    })

    req.write(postData)
    req.end()
  }
}

server.stdout.on('data', data => {
  console.log(`server: ${data}`)
  if (data.includes('Chrome Enterprise Premium MCP server listening on port')) {
    runToolTest()
  }
})

server.stderr.on('data', data => {
  console.error(`server error: ${data}`)
})

server.on('close', code => {
  console.log(`server process exited with code ${code}`)
})
