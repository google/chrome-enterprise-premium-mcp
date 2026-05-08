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

import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { loadDynamicDocs } from '../utils/dynamic_docs.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { FLAGS, FeatureFlags } from '../../lib/util/feature_flags.js'
import { getString, getNumber } from '../../lib/util/helpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_DIR = path.resolve(__dirname, '../../lib/knowledge')

const NON_PUBLIC_KNOWLEDGE_FILES = new Set(['README.md', '0-agent-capabilities.md'])

interface KnowledgeDoc {
  id: string
  filename: string
  title: string
  content: string
  articleId?: number
  summary?: string
  url?: string
}

interface KnowledgeDb {
  allDocs: KnowledgeDoc[]
  docLookup: Map<string, KnowledgeDoc>
  idToDoc: Map<string, KnowledgeDoc>
}

interface ScannedDoc {
  file: string
  filename: string
  filePath: string
  metadata: Record<string, unknown>
  content: string
}

let cachedDb: KnowledgeDb | null = null
let isDbLoading = false
let dbLoadingPromise: Promise<KnowledgeDb> | null = null

/**
 * Reads the knowledge directory once and returns one parsed entry per
 * publishable markdown file.
 * @param dir Directory containing the markdown knowledge files.
 * @returns One entry per `.md` file not in NON_PUBLIC_KNOWLEDGE_FILES.
 */
function scanKnowledgeDir(dir: string): ScannedDoc[] {
  const entries: ScannedDoc[] = []
  const files = fs.readdirSync(dir)
  files.sort((a, b) => {
    const numA = parseInt(a.split('-')[0], 10)
    const numB = parseInt(b.split('-')[0], 10)
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
 * @param html Raw HTML content.
 * @returns Cleaned text content.
 */
function cleanHtml(html: string): string {
  const $ = cheerio.load(html)

  $('script, style, nav, header, footer, devsite-toc').remove()

  const root =
    $('article').first().get(0) ||
    $('div.devsite-article-body').first().get(0) ||
    $('div.cc').first().get(0) ||
    $('main').first().get(0) ||
    $('body').get(0) ||
    $.root().get(0)

  let text = root ? $(root).text() : $.root().text()

  for (const pattern of BOILERPLATE_PATTERNS) {
    text = text.replace(pattern, '')
  }

  return text.replace(/\s+/g, ' ').trim()
}

export interface KnowledgeToolOptions extends GuardedToolOptions {
  dbPath?: string
  allDocs?: KnowledgeDoc[]
  docLookup?: Map<string, KnowledgeDoc>
  idToDoc?: Map<string, KnowledgeDoc>
  featureFlags?: FeatureFlags
}

/**
 * Registers knowledge search tools with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tools.
 * @param sessionState The session state object for caching.
 */
export function registerKnowledgeTools(
  server: McpServer,
  options: KnowledgeToolOptions,
  sessionState: SessionState,
): void {
  const flags = options.featureFlags
  logger.debug(`${TAGS.MCP} Registering Knowledge tools...`)

  const dirToRead = options.dbPath || DB_DIR
  let scannedDocs: ScannedDoc[] = []
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
      summary: String(d.metadata.summary),
      source: d.metadata.url ? 'Remote' : 'Local',
    }))

  const indexTable = docSummaries.map(s => `| **${s.filename}** | ${s.summary} | ${s.source} |`).join('\n')

  const knowledgeIndex = `### Knowledge Index
This index is for locating relevant documentation by topic. Document summaries are not a source of truth; for authoritative technical details, exact roles, or procedures, the agent retrieves the content in real-time via 'get_document'.

| Filename | Topics Covered | Source |
| :--- | :--- | :--- |
${indexTable}`

  const loadDb = async (): Promise<KnowledgeDb> => {
    if (options.allDocs) {
      return {
        allDocs: options.allDocs,
        docLookup: options.docLookup || new Map<string, KnowledgeDoc>(),
        idToDoc: options.idToDoc || new Map<string, KnowledgeDoc>(),
      }
    }

    if (cachedDb) {
      return cachedDb
    }
    if (isDbLoading && dbLoadingPromise) {
      return dbLoadingPromise
    }
    isDbLoading = true
    dbLoadingPromise = (async (): Promise<KnowledgeDb> => {
      try {
        const docLookup = new Map<string, KnowledgeDoc>()
        const idToDoc = new Map<string, KnowledgeDoc>()
        const allDocs: KnowledgeDoc[] = []

        for (const entry of scannedDocs) {
          const articleId = getNumber(entry.metadata, 'articleId')
          const title = getString(entry.metadata, 'title')
          const summary = getString(entry.metadata, 'summary')
          const url = getString(entry.metadata, 'url')

          const doc: KnowledgeDoc = {
            id: articleId ? String(articleId) : entry.file,
            filename: entry.filename,
            title: title || entry.filename,
            content: entry.content,
            articleId,
            summary,
            url,
          }
          allDocs.push(doc)
          docLookup.set(doc.filename, doc)
          idToDoc.set(doc.id, doc)
        }

        // Load Dynamic Documents (*.doc.js)
        const dynamicDocs = await loadDynamicDocs(dirToRead)
        dynamicDocs.forEach(doc => {
          const processedDoc: KnowledgeDoc = {
            id: String(doc.articleId || doc.filename),
            filename: doc.filename,
            title: doc.title || doc.filename,
            content: doc.content,
            articleId: doc.articleId,
            summary: doc.summary,
            url: doc.url,
          }
          allDocs.push(processedDoc)
          docLookup.set(doc.filename, processedDoc)
          idToDoc.set(processedDoc.id, processedDoc)
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

  if (flags?.isEnabled(FLAGS.KNOWLEDGE_SEARCH_ENABLED, false)) {
    logger.debug(`${TAGS.MCP} Registering search tools (EXPERIMENT_KNOWLEDGE_SEARCH_ENABLED is active)`)
    server.registerTool(
      'search_content',
      {
        description: `Searches the Chrome Enterprise Premium (CEP) knowledge base for verified product information.`,
        inputSchema: z.object({
          query: z.string().min(1).describe('Search query. Use concise keywords.'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe('Maximum number of results to return (default 10).'),
        }),
        outputSchema: z
          .object({
            documents: z.array(
              z
                .object({
                  id: z.string(),
                  title: z.string(),
                  filename: z.string(),
                  relevanceScore: z.number(),
                  get_document_arguments: z.object({
                    filename: z.string(),
                  }),
                  snippet: z.string(),
                  summary: z.string().optional(),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      },
      guardedToolCall(
        {
          handler: async (args): Promise<McpToolResponse> => {
            const query = getString(args, 'query') || ''
            const pLimit = args.limit
            const limit = typeof pLimit === 'number' ? pLimit : 10

            logger.info(`${TAGS.MCP} search_content called with query: "${query}"`)
            const db = await loadDb()
            const allDocs = db.allDocs

            if (!allDocs) {
              const sc = { documents: [] }
              return formatToolResponse({
                summary: 'Search index not loaded.',
                data: sc,
                structuredContent: sc,
              })
            }

            const queryLower = query.toLowerCase()
            const queryTerms = queryLower.split(/\s+/).filter(Boolean)

            const results = allDocs.filter(doc => {
              const searchableText = `${doc.title} ${doc.content} ${doc.summary || ''}`.toLowerCase()
              return queryTerms.some(term => searchableText.includes(term))
            })

            const boostedResults = results.map(doc => {
              let score = 1.0
              const searchableText = `${doc.title} ${doc.content} ${doc.summary || ''}`.toLowerCase()
              queryTerms.forEach(term => {
                score += (searchableText.split(term).length - 1) * 0.1
                if (doc.title.toLowerCase().includes(term)) {
                  score += 0.5
                }
                if (doc.summary?.toLowerCase().includes(term)) {
                  score += 0.3
                }
              })
              return { ...doc, score, originalId: doc.id }
            })

            boostedResults.sort((a, b) => b.score - a.score)
            const sliced = boostedResults.slice(0, limit)

            if (sliced.length === 0) {
              const sc = { documents: [] }
              return formatToolResponse({
                summary: `No search results found for: **${query}**`,
                data: sc,
                structuredContent: sc,
              })
            }

            const documents = sliced.map(r => {
              let snippet = ''
              if (r.content) {
                const contentLower = r.content.toLowerCase()
                let bestScore = -1
                let bestIndex = 0

                const commonWords = [
                  'chrome',
                  'enterprise',
                  'premium',
                  'security',
                  'the',
                  'and',
                  'for',
                  'to',
                  'a',
                  'in',
                  'of',
                  'is',
                ]
                const rareTerms = queryTerms.filter(t => !commonWords.includes(t))
                const searchTerms = rareTerms.length > 0 ? rareTerms : queryTerms

                for (let i = 0; i < contentLower.length; i += 100) {
                  const windowText = contentLower.substring(i, i + 200)
                  let score = 0
                  for (const term of searchTerms) {
                    if (windowText.includes(term)) {
                      score++
                    }
                  }
                  if (score > bestScore) {
                    bestScore = score
                    bestIndex = i
                  }
                }

                const start = Math.max(0, bestIndex)
                const end = Math.min(r.content.length, bestIndex + 200)
                snippet =
                  (start > 0 ? '...' : '') +
                  r.content.substring(start, end).replace(/\n/g, ' ') +
                  (end < r.content.length ? '...' : '')
              }

              return {
                id: r.originalId || r.id,
                title: r.title,
                filename: r.filename,
                relevanceScore: parseFloat(r.score.toFixed(2)),
                get_document_arguments: {
                  filename: r.filename,
                },
                summary: r.summary,
                snippet,
              }
            })

            const markdownList = documents
              .map((doc, index) => {
                const getDocHint = `*(To read full doc, use get_document with filename: "${doc.filename}")*`
                const summaryText = doc.summary ? `**Summary:** ${doc.summary}\n` : ''
                return `### ${index + 1}. ${doc.title}\n${getDocHint}\n${summaryText}**Snippet:** ${doc.snippet}\n`
              })
              .join('\n')

            const header = `## Search Results for "${query}"\n\nFound ${documents.length} matching documents.\n\n`

            return formatToolResponse({
              summary: header + markdownList,
              data: { documents },
              structuredContent: { documents },
            })
          },
          skipAutoResolve: true,
        },
        options,
        sessionState,
      ),
    )
  }

  server.registerTool(
    'get_document',
    {
      description: `Retrieves the full text of one or more knowledge base documents. Pass \`filename\` as a single value or an array (bundle). Each entry may be a filename string (e.g. "4-dlp-core-features") or a numeric articleId from a Markdown cross-link. Use the array form to load related articles in a single call.\n\n${knowledgeIndex}`,
      inputSchema: z.object({
        filename: z
          .union([z.array(z.coerce.string()).min(1).max(20), z.coerce.string()])
          .describe('A single filename/articleId, or an array of them (up to 20).'),
      }),
      outputSchema: z
        .object({
          documents: z.array(
            z.object({ id: z.string(), filename: z.string(), title: z.string(), content: z.string() }).passthrough(),
          ),
          missing: z.array(z.string()),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>): Promise<McpToolResponse> => {
          const GetDocumentSchema = z.object({
            filename: z.union([z.array(z.coerce.string()).min(1).max(20), z.coerce.string()]),
          })
          const { filename } = GetDocumentSchema.parse(params)
          const db = await loadDb()
          const { docLookup, idToDoc } = db

          const resolveOne = (name: unknown): KnowledgeDoc | undefined => {
            const key = String(name)
            let doc = docLookup.get(key)
            if (!doc) {
              const clean = key.replace(/\.md$/, '').replace(/\.doc\.js$/, '')
              doc = docLookup.get(clean)
            }
            if (!doc) {
              const m = key.match(/^\d+/)
              if (m) {
                doc = idToDoc.get(m[0])
              }
            }
            return doc
          }

          const requested = Array.isArray(filename) ? filename : [filename]
          const found: KnowledgeDoc[] = []
          const missing: string[] = []

          for (const f of requested) {
            const doc = resolveOne(f)
            if (doc) {
              if (doc.url) {
                try {
                  logger.info(`${TAGS.MCP} Fetching remote document: ${doc.url}`)
                  const response = await axios.get<string>(doc.url, {
                    headers: {
                      'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    },
                    timeout: 10000,
                  })
                  const cleanContent = cleanHtml(response.data)
                  logger.info(
                    `${TAGS.MCP} Remote document fetched and cleaned: ${doc.filename} (${cleanContent.length} chars)`,
                  )
                  found.push({ ...doc, content: cleanContent })
                } catch (e) {
                  const errMsg = e instanceof Error ? e.message : String(e)
                  logger.error(`${TAGS.MCP} Failed to fetch remote document: ${doc.url}`, errMsg)
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
            const searchEnabled = !!flags?.isEnabled(FLAGS.KNOWLEDGE_SEARCH_ENABLED, false)
            const hint = searchEnabled
              ? ' Call `search_content` or `list_documents` to find valid filenames.'
              : ' Verify the filename and try again.'
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: No documents found for: ${missing.join(', ')}.${hint}`,
                },
              ],
              structuredContent: { documents: [], missing },
              isError: true,
            }
          }

          const summary = found.map(d => `## ${d.title}\n\n${d.content}`).join('\n\n---\n\n')
          const suffix = missing.length ? `\n\n---\n\n_(Missing: ${missing.join(', ')})_` : ''

          const dataWithoutContent = found.map(({ content: _content, ...d }) => d)

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

  if (flags?.isEnabled(FLAGS.KNOWLEDGE_SEARCH_ENABLED, false)) {
    server.registerTool(
      'list_documents',
      {
        description: 'Lists all available documents in the knowledge base.',
        inputSchema: z.object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .optional()
            .describe('Maximum number of documents to list (default 50).'),
          offset: z.number().int().min(0).optional().describe('Pagination offset to skip records (default 0).'),
        }),
        outputSchema: z
          .object({
            documents: z.array(
              z
                .object({
                  title: z.string(),
                  get_document_arguments: z.object({
                    filename: z.string(),
                  }),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      },
      guardedToolCall(
        {
          handler: async (args): Promise<McpToolResponse> => {
            const pLimit = args.limit
            const pOffset = args.offset
            const limit = typeof pLimit === 'number' ? pLimit : 50
            const offset = typeof pOffset === 'number' ? pOffset : 0

            const db = await loadDb()
            const docLookup = db.docLookup
            const allDocs = Array.from(docLookup.values())

            const sorted = [...allDocs].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
            const sliced = sorted.slice(offset, offset + limit)

            const documents = sliced.map(r => ({
              title: r.title,
              get_document_arguments: {
                filename: r.filename,
              },
            }))

            const text =
              `## Knowledge Base (${allDocs.length} articles)\n\n` +
              documents.map((doc, idx) => `${idx + 1 + offset}. ${doc.title}`).join('\n')

            return formatToolResponse({
              summary: text,
              data: { documents },
              structuredContent: { documents },
            })
          },
          skipAutoResolve: true,
        },
        options,
        sessionState,
      ),
    )
  }

  if (!('registerResource' in server) || typeof server.registerResource !== 'function') {
    return
  }
  for (const entry of scannedDocs) {
    const { filename } = entry
    const uri = `cep://knowledge/${filename}`
    const summary = getString(entry.metadata, 'summary') || ''
    const title = getString(entry.metadata, 'title') || filename
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
