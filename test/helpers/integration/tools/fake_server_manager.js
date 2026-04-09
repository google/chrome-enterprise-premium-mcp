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

import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'
import { TAGS } from '../../../../lib/constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Manages the lifecycle of the Fake API Server for Node.js tests.
 */
class FakeServerManager {
  constructor() {
    this.process = null
    this.rootUrl = null
    this.startPromise = null

    // Ensure we kill the child process if the main process exits
    process.on('exit', () => this.stopSync())
    process.on('SIGINT', () => {
      this.stopSync()
      process.exit()
    })
    process.on('SIGTERM', () => {
      this.stopSync()
      process.exit()
    })
  }

  /**
   * Starts the fake server if it's not already running.
   * Returns a promise that resolves when the server is healthy.
   */
  async start() {
    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this._doStart()
    return this.startPromise
  }

  async _doStart() {
    const backend = process.env.CEP_BACKEND
    if (backend !== 'fake') {
      return
    }

    console.log(`${TAGS.MCP} Starting Fake API Server (Node.js)...`)

    const fakeApiScript = join(__dirname, '..', '..', 'fake-api-server.js')

    // Use port 0 for dynamic assignment to avoid conflicts during parallel testing
    this.process = spawn('node', [fakeApiScript], {
      env: { ...process.env, PORT: '0' },
      detached: false,
    })

    return new Promise((resolve, reject) => {
      let resolved = false

      this.process.stdout.on('data', data => {
        const output = data.toString()
        if (process.env.DEBUG_FAKE_API) {
          console.log(`[FAKE API] ${output.trim()}`)
        }

        // Capture the dynamic URL from the server output
        const match = output.match(/Fake API server running on (http:\/\/localhost:\d+)/)
        if (match && !resolved) {
          this.rootUrl = match[1]
          process.env.GOOGLE_API_ROOT_URL = this.rootUrl

          // Perform a quick health check
          this._waitForHealth()
            .then(() => {
              resolved = true
              resolve()
            })
            .catch(reject)
        }
      })

      this.process.stderr.on('data', data => {
        console.error(`[FAKE API ERROR] ${data.toString().trim()}`)
      })

      this.process.on('error', err => {
        console.error(`${TAGS.MCP} Failed to spawn Fake API Server:`, err)
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })

      this.process.on('exit', code => {
        if (!resolved) {
          resolved = true
          reject(new Error(`Fake API Server exited prematurely with code ${code}`))
        }
      })
    })
  }

  async _waitForHealth() {
    const maxRetries = 20
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(`${this.rootUrl}/admin/directory/v1/customers/C0123456`, { timeout: 1000 })
        if (response.status === 200) {
          console.log(`${TAGS.MCP} Fake API Server is healthy at ${this.rootUrl}`)
          return
        }
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    throw new Error('Fake API Server failed to become healthy in time.')
  }

  /**
   * Stops the fake server process asynchronously.
   */
  async stop() {
    if (this.process) {
      console.log(`${TAGS.MCP} Stopping Fake API Server at ${this.rootUrl}...`)
      const p = this.process
      this.process = null
      this.startPromise = null
      this.rootUrl = null

      return new Promise(resolve => {
        p.on('exit', () => resolve())
        p.kill()
        // Safety timeout
        setTimeout(() => {
          p.kill('SIGKILL')
          resolve()
        }, 2000)
      })
    }
  }

  /**
   * Synchronous stop for process exit hooks.
   */
  stopSync() {
    if (this.process) {
      this.process.kill('SIGKILL')
      this.process = null
      this.startPromise = null
    }
  }
}

// Singleton instance
export const fakeServerManager = new FakeServerManager()
