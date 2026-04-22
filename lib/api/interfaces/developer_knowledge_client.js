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
 * @file Interface for Developer Knowledge API client wrappers.
 */

/**
 * @interface DeveloperKnowledgeClient
 */
export class DeveloperKnowledgeClient {
  /**
   * Searches for document chunks in the developer knowledge base.
   * @param {string} _query - The search query.
   * @param {number} [_limit] - Maximum number of results.
   * @returns {Promise<object>} - The search results.
   */
  async searchDocumentChunks(_query, _limit) {
    throw new Error('Not implemented')
  }

  /**
   * Retrieves a full document from the developer knowledge base.
   * @param {string} _documentName - The resource name of the document.
   * @returns {Promise<object>} - The document content.
   */
  async getDocument(_documentName) {
    throw new Error('Not implemented')
  }
}
