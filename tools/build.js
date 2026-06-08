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
 * @file Build coordinator script. Compiles docs, bundles code with esbuild,
 * and packages it into a standalone Node SEA binary.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

/**
 * Detects the Node SEA sentinel fuse from the Node binary.
 * @param {string} nodeBinary - Path to the Node binary.
 * @returns {string} The detected sentinel fuse.
 */
function detectSentinel(nodeBinary) {
  const data = fs.readFileSync(nodeBinary)
  const searchStr = 'NODE_SEA_FUSE_'
  const searchBuf = Buffer.from(searchStr)
  const pos = data.indexOf(searchBuf)
  if (pos === -1) {
    throw new Error('Could not find NODE_SEA_FUSE_ in Node binary')
  }
  const chunk = data.subarray(pos, pos + 100).toString('ascii')
  const match = chunk.match(/^(NODE_SEA_FUSE_[0-9a-fA-F]+)/)
  if (!match) {
    throw new Error('Could not parse sentinel fuse from binary')
  }
  return match[1]
}

/**
 * Main execution function to build the binary.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('Starting build process...')

  // 1. Compile docs
  console.log('\n--- Step 1: Compiling documents ---')
  execSync('node tools/compile-docs.js', { stdio: 'inherit', cwd: ROOT })

  // Ensure dist dir exists
  const distDir = path.join(ROOT, 'dist')
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true })
  }

  // 2. Bundle with esbuild
  console.log('\n--- Step 2: Bundling with esbuild ---')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'bin/cli.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.join(distDir, 'bundle.js'),
    format: 'cjs',
    define: {
      'import.meta.url': '"file:///dummy.js"',
    },
    logLevel: 'info',
  })

  // 3. Generate SEA prep blob
  console.log('\n--- Step 3: Generating SEA preparation blob ---')
  execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit', cwd: ROOT })

  // 4. Create binary and inject blob
  console.log('\n--- Step 4: Packaging standalone binary ---')
  const nodeBinary = process.execPath
  const targetBinary = path.join(distDir, 'cep-mcp')

  console.log(`Copying Node binary from ${nodeBinary} to ${targetBinary}...`)
  fs.copyFileSync(nodeBinary, targetBinary)

  const sentinel = detectSentinel(nodeBinary)
  console.log(`Detected SEA sentinel: ${sentinel}`)

  console.log('Injecting blob into binary...')
  // Run postject. We use npx to run the locally installed postject.
  const postjectCmd = `npx postject "${targetBinary}" NODE_SEA_BLOB "${path.join(distDir, 'sea-prep.blob')}" --sentinel-fuse ${sentinel}`
  console.log(`Running: ${postjectCmd}`)
  execSync(postjectCmd, { stdio: 'inherit', cwd: ROOT })

  console.log('\nBuild complete! Standalone binary available at dist/cep-mcp')
}

main().catch(err => {
  console.error('Build failed:', err)
  throw err
})
