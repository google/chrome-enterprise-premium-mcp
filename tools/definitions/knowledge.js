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
 * @file Tool definitions for content search and document retrieval.
 */

import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { loadDynamicDocs } from '../utils/dynamic_docs.js'
import { z } from 'zod'
import fs from 'fs'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import axios from 'axios'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_DIR = path.resolve(__dirname, '../../lib/knowledge')

// Files in lib/knowledge that exist on disk but must not surface as
// retrievable documents. README.md is project-internal documentation.
// 0-agent-capabilities.md is the agent's own capabilities/boundaries
// reference — it shapes the agent's behavior and is loaded into its
// context, but exposing it via get_document or as an MCP resource picker
// entry would let users browse/exfiltrate the agent's control surface.
const NON_PUBLIC_KNOWLEDGE_FILES = new Set(['README.md', '0-agent-capabilities.md'])

let cachedDb = null
let isDbLoading = false
let dbLoadingPromise = null

/**
 * Reads the knowledge directory once and returns one parsed entry per
 * publishable markdown file. Used at registration time to populate the
 * docSummaries index, the cached DB, and the MCP resource list from a
 * single set of file reads.
 * @param {string} dir Directory containing the markdown knowledge files.
 * @returns {Array<{file: string, filename: string, filePath: string, metadata: object, content: string}>}
 * One entry per `.md` file not in NON_PUBLIC_KNOWLEDGE_FILES, sorted by
 * leading numeric prefix where present, otherwise by filename.
 */
function scanKnowledgeDir(dir) {
  const entries = []
  const files = fs.readdirSync(dir)
  files.sort((a, b) => {
    const numA = parseInt(a.split('-')[0])
    const numB = parseInt(b.split('-')[0])
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    return a.localeCompare(b)
  })
  for (const file of files) {
    if (!file.endsWith('.md') || NON_PUBLIC_KNOWLEDGE_FILES.has(file)) {
      continue
    }
    const filePath = path.join(dir, file)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data: metadata, content } = matter(fileContent)
    entries.push({
      file,
      filename: file.replace(/\.md$/, ''),
      filePath,
      metadata,
      content,
    })
  }
  return entries
}

/**
 * Boilerplate phrases that frequently appear in devsite/help-center pages
 * and add noise to the LLM context without contributing meaning.
 */
const BOILERPLATE_PATTERNS = [
  /Google Workspace Help/g,
  /Administrators/g,
  /Security & data protection/g,
  /Guides/g,
  /Send feedback/g,
  /Stay organized with collections Save and categorize content based on your preferences\./g,
  /Got 5 mins\? Help us with a quick survey about Google Workspace admin help center tasks\./g,
  /Compare your edition/g,
]

/**
 * Strips HTML tags and extracts main content from a page to optimize token usage.
 * Uses cheerio (a real HTML parser) rather than regex so browser-lenient
 * markup like `</script\t\nbar>` or unclosed `<style>` blocks can't smuggle
 * tag substrings into the LLM-bound output.
 * @param {string} html Raw HTML content.
 * @returns {string} Cleaned text content.
 */
function cleanHtml(html) {
  const $ = cheerio.load(html)

  // Drop non-content blocks entirely (cheerio removes the element + descendants).
  $('script, style, nav, header, footer, devsite-toc').remove()

  // Pick the most-specific main-content container; fall back to <body>.
  const root =
    $('article').first().get(0) ||
    $('div.devsite-article-body').first().get(0) ||
    $('div.cc').first().get(0) ||
    $('main').first().get(0) ||
    $('body').get(0) ||
    $.root().get(0)

  let text = $(root).text()

  for (const pattern of BOILERPLATE_PATTERNS) {
    text = text.replace(pattern, '')
  }

  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Registers knowledge search tools with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerKnowledgeTools(server, options, sessionState) {
  logger.debug(`${TAGS.MCP} Registering Knowledge tools...`)

  const dirToRead = options.dbPath || DB_DIR
  // When tests pass options.allDocs, they're bypassing on-disk loading
  // entirely; skip the scan so we don't read the real knowledge dir
  // during isolated tests.
  let scannedDocs = []
  if (!options.allDocs) {
    try {
      scannedDocs = scanKnowledgeDir(dirToRead)
    } catch (e) {
      logger.error(`${TAGS.MCP} Failed to scan knowledge directory:`, e)
    }
  }

  const docSummaries = scannedDocs
    .filter(d => d.metadata.summary)
    .map(d => ({
      filename: d.filename,
      summary: d.metadata.summary,
      source: d.metadata.url ? 'Remote' : 'Local',
    }))

  const indexTable = docSummaries.map(s => `| **${s.filename}** | ${s.summary} | ${s.source} |`).join('\n')

  const knowledgeIndex = `### Knowledge Index
This index is for locating relevant documentation by topic. Document summaries are not a source of truth; for authoritative technical details, exact roles, or procedures, the agent retrieves the content in real-time via 'get_document'.

| Filename | Topics Covered | Source |
| :--- | :--- | :--- |
${indexTable}`

  /**
   * Loads the knowledge database from markdown files.
   * @returns {Promise<object>} The loaded database object.
   */
  const loadDb = async () => {
    if (options.allDocs) {
      return {
        allDocs: options.allDocs,
        docLookup: options.docLookup || new Map(),
        idToDoc: options.idToDoc || new Map(),
      }
    }

    if (cachedDb) {
      return cachedDb
    }
    if (isDbLoading) {
      return dbLoadingPromise
    }
    isDbLoading = true
    dbLoadingPromise = (async () => {
      try {
        const docLookup = new Map()
        const idToDoc = new Map()
        const allDocs = []

        for (const entry of scannedDocs) {
          const doc = {
            id: String(entry.metadata.articleId || entry.file),
            filename: entry.filename,
            title: entry.metadata.title || entry.filename,
            content: entry.content,
            articleId: entry.metadata.articleId,
            summary: entry.metadata.summary,
            url: entry.metadata.url,
          }
          allDocs.push(doc)
          docLookup.set(doc.filename, doc)
          idToDoc.set(String(doc.id), doc)
        }

        // Load Dynamic Documents (*.doc.js)
        const dynamicDocs = await loadDynamicDocs(dirToRead)
        dynamicDocs.forEach(doc => {
          const processedDoc = {
            ...doc,
            id: String(doc.articleId || doc.filename),
          }
          allDocs.push(processedDoc)
          docLookup.set(doc.filename, processedDoc)
          idToDoc.set(String(processedDoc.id), processedDoc)
        })

        cachedDb = { allDocs, docLookup, idToDoc }
        return cachedDb
      } catch (e) {
        logger.error(`${TAGS.MCP} Failed to load knowledge index:`, e)
        throw e
      } finally {
        isDbLoading = false
      }
    })()
    return dbLoadingPromise
  }

  server.registerTool(
    'get_document',
    {
      description: `Retrieves the full text of one or more knowledge base documents. Pass \`filename\` as a single value or an array (bundle). Each entry may be a filename string (e.g. "4-dlp-core-features") or a numeric articleId from a Markdown cross-link. Use the array form to load related articles in a single call.

${knowledgeIndex}`,
      inputSchema: z.object({
        // Coerce to string so the tool accepts numeric articleIds (e.g. `4`)
        // directly — agents extracting the ID from a Markdown cross-link often
        // send it as a number. The array is capped at 20 entries to keep the
        // response under our per-call payload budget.
        filename: z
          // Try the array form first; `z.coerce.string()` accepts any input
          // including arrays (it calls `.toString()`), so ordering matters.
          .union([z.array(z.coerce.string()).min(1).max(20), z.coerce.string()])
          .describe(
            'A single filename/articleId, or an array of them (up to 20). Numeric articleIds are coerced to strings.',
          ),
      }),
      outputSchema: z.looseObject({
        documents: z.array(
          z.looseObject({ id: z.string(), filename: z.string(), title: z.string(), content: z.string() }),
        ),
        missing: z.array(z.string()),
      }),
    },
    guardedToolCall(
      {
        handler: async args => {
          const db = await loadDb()
          const { docLookup, idToDoc } = db

          const resolveOne = name => {
            let doc = docLookup.get(name)
            if (!doc) {
              const clean = String(name)
                .replace(/\.md$/, '')
                .replace(/\.doc\.js$/, '')
              doc = docLookup.get(clean)
            }
            if (!doc) {
              const m = String(name).match(/^\d+/)
              if (m) {
                doc = idToDoc.get(m[0])
              }
            }
            return doc
          }

          const requested = Array.isArray(args.filename) ? args.filename : [args.filename]
          const found = []
          const missing = []
          for (const f of requested) {
            const doc = resolveOne(f)
            if (doc) {
              // Smart Proxy: If the document has a URL, fetch it from the web
              if (doc.url) {
                try {
                  let fetchUrl = doc.url
                  // Test/Eval Sandbox redirection:
                  // If the server was initialized with a local rootUrl (which happens during
                  // offline unit, integration, and evaluation runs), rewrite 'support.google.com'
                  // links to target the in-process fake API server. This allows sandbox environments
                  // to retrieve verified mock HTML documentation without reaching out to the live web,
                  // while allowing production runs to fetch authentic, live Help Center updates.
                  if (options.apiOptions?.rootUrl) {
                    fetchUrl = doc.url.replace('https://support.google.com', options.apiOptions.rootUrl)
                  }
                  logger.info(`${TAGS.MCP} Fetching remote document: ${fetchUrl}`)
                  const response = await axios.get(fetchUrl, {
                    headers: {
                      'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    },
                    timeout: 10000,
                  })
                  // Extract clean text from HTML to save tokens and improve quality
                  const cleanContent = cleanHtml(response.data)
                  logger.info(
                    `${TAGS.MCP} Remote document fetched and cleaned: ${doc.filename} (${cleanContent.length} chars)`,
                  )
                  found.push({ ...doc, content: cleanContent })
                } catch (e) {
                  logger.error(`${TAGS.MCP} Failed to fetch remote document: ${doc.url}`, e.message)
                  // Fallback to local stub content if fetch fails
                  found.push(doc)
                }
              } else {
                found.push(doc)
              }
            } else {
              missing.push(String(f))
            }
          }

          if (found.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: No documents found for: ${missing.join(', ')}. Verify the filename and try again.`,
                },
              ],
              structuredContent: { documents: [], missing },
              isError: true,
            }
          }

          const summary = found.map(d => `## ${d.title}\n\n${d.content}`).join('\n\n---\n\n')
          const suffix = missing.length ? `\n\n---\n\n_(Missing: ${missing.join(', ')})_` : ''

          // Optimization: Strip content from structured data to avoid token "double-charging"
          // The agent already has the content in the summary block above.
          const dataWithoutContent = found.map(d => {
            const copy = { ...d }
            delete copy.content
            return copy
          })

          return formatToolResponse({
            summary: summary + suffix,
            data: { documents: dataWithoutContent, missing },
            structuredContent: { documents: found, missing },
          })
        },

        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )

  // Register each knowledge article as an MCP resource (skipped if the server
  // implementation does not expose registerResource, e.g. lightweight test mocks).
  if (typeof server.registerResource !== 'function') {
    return
  }
  for (const entry of scannedDocs) {
    const { filename } = entry
    const uri = `cep://knowledge/${filename}`
    const summary = entry.metadata?.summary || ''
    const title = entry.metadata?.title || filename
    server.registerResource(filename, uri, { title, description: summary, mimeType: 'text/markdown' }, async () => {
      const db = await loadDb()
      const doc = db.docLookup.get(filename)
      if (!doc) {
        return { contents: [] }
      }
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: `## ${doc.title}\n\n${doc.content}` }],
      }
    })
  }
}
