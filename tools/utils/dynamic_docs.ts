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

import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { getString, getNumber, isObject, getObject } from '../../lib/util/helpers.js'

export interface DynamicDoc {
  articleId?: number
  filename: string
  title?: string
  content: string
  kind: string
  url?: string
  summary?: string
}

/**
 * Automatically discovers and loads dynamic documentation modules (*.doc.js).
 * @param directory The directory to search for dynamic docs.
 * @returns A list of loaded document objects.
 */
export async function loadDynamicDocs(directory: string): Promise<DynamicDoc[]> {
  const docs: DynamicDoc[] = []
  if (!fs.existsSync(directory)) {
    return docs
  }

  const files = fs.readdirSync(directory)
  for (const file of files) {
    if (file.endsWith('.doc.js')) {
      try {
        const filePath = path.join(directory, file)
        // Use pathToFileURL to ensure compatibility across OS (especially Windows)
        const rawModule: unknown = await import(pathToFileURL(filePath).href)
        if (isObject(rawModule)) {
          const doc = getObject(rawModule, 'doc')
          if (doc) {
            const articleId = getNumber(doc, 'articleId')
            const title = getString(doc, 'title')
            const content = getString(doc, 'content') || ''
            const kind = getString(doc, 'kind') || 'curated'
            const url = getString(doc, 'url')
            const summary = getString(doc, 'summary')

            docs.push({
              articleId,
              filename: file.replace('.doc.js', ''),
              title,
              content,
              kind,
              url,
              summary,
            })
          }
        }
      } catch (e) {
        logger.error(`${TAGS.MCP} Failed to load dynamic doc ${file}:`, e)
      }
    }
  }
  return docs
}
