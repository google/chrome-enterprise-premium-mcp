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
 * @fileoverview Tool definitions for content search and document retrieval.
 */

import { guardedToolCall } from '../utils/wrapper.js'
import { inputSchemas, outputSchemas } from '../utils.js'
import { z } from 'zod'
import fs from 'fs'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_DIR = path.resolve(__dirname, '../../lib/knowledge')

let cachedDb = null
let isDbLoading = false
let dbLoadingPromise = null

function parseMarkdownFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  const metadata = {}
  let body = content

  if (match) {
    const frontmatter = match[1]
    body = content.slice(match[0].length).trim()

    frontmatter.split('\n').forEach(line => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex !== -1) {
        const key = line.slice(0, separatorIndex).trim()
        let value = line.slice(separatorIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        metadata[key] = value
      }
    })
  }

  return { metadata, content: body }
}

/**
 * Registers knowledge search tools with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerKnowledgeTools(server, options, sessionState) {
  logger.debug(`${TAGS.MCP} Registering Knowledge tools...`)

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
    dbLoadingPromise = new Promise((resolve, reject) => {
      try {
        const docLookup = new Map()
        const idToDoc = new Map()
        const allDocs = []

        const dirToRead = options.dbPath || DB_DIR
        const files = fs.readdirSync(dirToRead)
        files.forEach(file => {
          if (file.endsWith('.md')) {
            const filePath = path.join(dirToRead, file)
            const fileContent = fs.readFileSync(filePath, 'utf-8')
            const { metadata, content } = parseMarkdownFrontmatter(fileContent)

            const doc = {
              id: metadata.articleId || file,
              filename: file.replace('.md', ''),
              kind: metadata.kind || 'curated',
              title: metadata.title || file.replace('.md', ''),
              content: content,
              articleType: metadata.articleType,
              articleId: metadata.articleId,
            }

            allDocs.push(doc)
            docLookup.set(`${doc.kind}/${doc.filename}`, doc)
            idToDoc.set(String(doc.id), doc)
          }
        })

        cachedDb = { allDocs, docLookup, idToDoc }
        resolve(cachedDb)
      } catch (e) {
        logger.error(`${TAGS.MCP} Failed to load knowledge index:`, e)
        reject(e)
      } finally {
        isDbLoading = false
      }
    })
    return dbLoadingPromise
  }

  server.registerTool(
    'search_content',
    {
      description: `Searches the Chrome Enterprise Premium knowledge base. Use this for any CEP-related question to ground your response in verified documentation.

Use this when the user mentions: Chrome Enterprise Premium, CEP, BeyondCorp, Data Loss Prevention, DLP, Context-Aware Access, CAA, Endpoint Verification, EV, browser security, Chrome management, connectors, evidence locker, URL filtering, or certificate-based access.

Topics covered: product overview, pricing and licensing, browser deployment and enrollment, endpoint verification troubleshooting, DLP features (rules, triggers, detectors, OCR, cache encryption), DLP troubleshooting, evidence locker and scanning, context-aware access and security gateway, identity and certificate-based access, SIEM/reporting integration, policy management and URL filtering, and agent capabilities/limitations.

If initial results aren't relevant, try different keywords rather than repeating the same query.`,
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe('Search query. Use concise keywords. Do not use full sentences or FTS5 syntax.'),
        kind: z
          .enum(['policies', 'helpcenter', 'cloud-docs', 'curated'])
          .optional()
          .describe('Filter results to a specific content type.'),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum number of results to return (default 10).'),
      }),
    },
    guardedToolCall(
      {
        handler: async args => {
          logger.info(`${TAGS.MCP} search_content called with query: "${args.query}"`)
          const db = await loadDb()
          const allDocs = db.allDocs
          const idToDoc = db.idToDoc

          if (!allDocs) {
            return { content: [{ type: 'text', text: 'Search index not loaded.' }] }
          }
          const limit = args.limit ?? 10

          const queryLower = args.query.toLowerCase()
          const queryTerms = queryLower.split(/\s+/).filter(Boolean)

          const results = allDocs.filter(doc => {
            if (args.kind && doc.kind !== args.kind) {
              return false
            }
            const searchableText = `${doc.title || ''} ${doc.content || ''}`.toLowerCase()
            return queryTerms.some(term => searchableText.includes(term)) // Use some for fuzzy match
          })

          const boostedResults = results.map(doc => {
            let score = 1.0
            const searchableText = `${doc.title || ''} ${doc.content || ''}`.toLowerCase()
            queryTerms.forEach(term => {
              score += (searchableText.split(term).length - 1) * 0.1
              if ((doc.title || '').toLowerCase().includes(term)) {
                score += 0.5
              }
            })
            if (doc.kind === 'curated') {
              score *= 2.0 // Boost curated content
            }
            return { ...doc, score, originalId: doc.id }
          })

          boostedResults.sort((a, b) => b.score - a.score)

          let sliced = boostedResults.slice(0, limit)

          // Ensure at least one curated result is included if it exists anywhere in the hits
          const curatedHits = boostedResults.filter(r => r.kind === 'curated')
          if (curatedHits.length > 0) {
            const hasCuratedInSlice = sliced.some(r => r.kind === 'curated')
            if (!hasCuratedInSlice) {
              sliced.push(curatedHits[0]) // Append the top curated hit even if it pushes us past the limit
            }
          }

          if (sliced.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No search results found for: **${args.query}**`,
                },
              ],
              structuredContent: { documents: [] },
            }
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

              // Slide a window of 500 chars to find the most terms
              for (let i = 0; i < contentLower.length; i += 250) {
                const windowText = contentLower.substring(i, i + 800)
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
              const end = Math.min(r.content.length, bestIndex + 800)
              snippet =
                (start > 0 ? '...' : '') +
                r.content.substring(start, end).replace(/\n/g, ' ') +
                (end < r.content.length ? '...' : '')
            }

            return {
              id: r.originalId || r.id,
              title: r.title,
              url: r.url || null,
              kind: r.kind,
              filename: r.filename,
              isDeprecated: r.deprecated === 1,
              relevanceScore: parseFloat(r.score.toFixed(2)),
              get_document_arguments: {
                kind: r.kind,
                filename: r.filename,
              },
              snippet: snippet,
            }
          })

          const markdownList = documents
            .map((doc, index) => {
              const status = doc.isDeprecated ? ' ⚠️ [Deprecated]' : ''
              const titleLink = doc.url ? `[${doc.title}](${doc.url})` : doc.title
              const getDocHint = `*(To read full doc, use get_document with kind: "${doc.kind}" and filename: "${doc.filename}")*`
              return `### ${index + 1}. ${titleLink}${status}\n${getDocHint}\n**Snippet:** ${doc.snippet}\n`
            })
            .join('\n')

          const hasCurated = documents.some(doc => doc.kind === 'curated')
          let header = `## Search Results for "${args.query}"\n\nFound ${documents.length} matching documents.\n\n`
          if (hasCurated) {
            header += `**Note:** Results marked as 'curated' are officially curated golden paths. If there are conflicts or ambiguities, you MUST bias your response towards the curated instructions. Please read both curated and non-curated documents if you are unsure.\n\n`
          }

          return {
            content: [
              {
                type: 'text',
                text: header + markdownList,
              },
            ],
            structuredContent: { documents },
          }
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )

  server.registerTool(
    'get_document',
    {
      description:
        'Retrieves the full text content of a specific knowledge base document. Use the "kind" and "filename" returned by search_content.',
      inputSchema: z.object({
        kind: z.enum(['policies', 'helpcenter', 'cloud-docs', 'curated']).describe('The content type / directory.'),
        filename: z.string().min(1).describe('The filename (without .md extension) as returned by search_content.'),
      }),
    },
    guardedToolCall(
      {
        handler: async args => {
          const db = await loadDb()
          const docLookup = db.docLookup

          const doc = docLookup.get(`${args.kind}/${args.filename}`)

          if (!doc) {
            return {
              content: [
                {
                  type: 'text',
                  text: `⚠️ **Error:** Document not found for \`${args.kind}/${args.filename}\`.`,
                },
              ],
            }
          }

          const urlLink = doc.url ? `[View Source](${doc.url})` : 'N/A'
          const facts = []
          if (doc.kind === 'policies') {
            if (doc.policyId) {
              facts.push(`- **Policy ID:** ${doc.policyId}`)
            }
            if (doc.supportedPlatformsText) {
              facts.push(`- **Platforms:** ${doc.supportedPlatformsText}`)
            }
          }
          const factsHeader = facts.length > 0 ? `### Key Facts\n${facts.join('\n')}\n\n` : ''

          const sourcesFooter = doc.url ? `\n\n---\n### Sources\n- [Official Documentation](${doc.url})` : ''

          const text = `# ${doc.title}\n\n**Category:** ${doc.kind} | **Source:** ${urlLink}\n\n${factsHeader}--- \n\n${doc.content}${sourcesFooter}`

          return {
            content: [
              {
                type: 'text',
                text,
              },
            ],
            structuredContent: { document: doc },
          }
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )

  server.registerTool(
    'list_documents',
    {
      description: `
<what>Lists all available documents within a specific category, or provides aggregated counts across all categories.</what>
<when>Use this to browse the library structure or when you need to verify the existence of a set of policies without a specific keyword search.</when>
<returns>A list of document titles or category counts.</returns>`,
      inputSchema: z.object({
        kind: z
          .enum(['policies', 'helpcenter', 'cloud-docs', 'curated'])
          .optional()
          .describe('Filter to a specific content type. Omit for counts across all kinds.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum number of documents to list (default 50). Ignored when kind is omitted.'),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Pagination offset to skip records (default 0). Ignored when kind is omitted.'),
      }),
    },
    guardedToolCall(
      {
        handler: async args => {
          const db = await loadDb()
          const docLookup = db.docLookup

          const allDocs = Array.from(docLookup.values())

          if (!args.kind) {
            const countsMap = new Map()
            for (const doc of allDocs) {
              countsMap.set(doc.kind, (countsMap.get(doc.kind) || 0) + 1)
            }
            const counts = Object.fromEntries(countsMap)

            const text =
              `## Knowledge Base Overview\n\n` +
              Object.entries(counts)
                .map(([kind, count]) => `- **${kind}**: ${count} articles`)
                .join('\n')

            return {
              content: [{ type: 'text', text }],
              structuredContent: { counts },
            }
          }

          const limit = args.limit ?? 50
          const offset = args.offset ?? 0

          let filtered = allDocs.filter(d => d.kind === args.kind)
          filtered.sort((a, b) => {
            const depA = a.deprecated || 0
            const depB = b.deprecated || 0
            if (depA !== depB) {
              return depA - depB
            }
            return (a.title || '').localeCompare(b.title || '')
          })

          const sliced = filtered.slice(offset, offset + limit)

          const documents = sliced.map(r => ({
            title: r.title,
            url: r.url || null,
            isDeprecated: r.deprecated === 1,
            get_document_arguments: {
              kind: r.kind,
              filename: r.filename,
            },
          }))

          const text =
            `## Articles in "${args.kind}"\n\n` +
            documents
              .map((doc, idx) => {
                const titleLink = doc.url ? `[${doc.title}](${doc.url})` : doc.title
                return `${idx + 1 + offset}. ${titleLink}${doc.isDeprecated ? ' ⚠️' : ''}`
              })
              .join('\n')

          return {
            content: [{ type: 'text', text }],
            structuredContent: { documents: sliced },
          }
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
