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

import {
  CEL_SYNTAX_GUIDE,
  UNIVERSAL_CONTENT_TYPES,
  NAVIGATION_CONTENT_TYPES,
  PASTE_CONTENT_TYPES,
  FILE_CONTENT_TYPES,
  CEL_FUNCTIONS,
  CHROME_CONTEXTS,
  CEL_COMPATIBILITY_RULES,
  PREDEFINED_DETECTORS,
  SPECIALIZED_CONTENT_TYPES,
  ACTION_PARAMETER_CONSTRAINTS,
  MCP_SAFETY_CONSTRAINTS,
  VALID_WEB_CATEGORIES,
} from '../util/chrome_dlp_constants.js'

const syntaxGuide = CEL_SYNTAX_GUIDE.map(
  item => `${item.rule}\n${item.examples.map(ex => `   Example: "${ex}"`).join('\n')}`,
).join('\n')

const universalTypes = Object.entries(UNIVERSAL_CONTENT_TYPES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const navTypes = Object.entries(NAVIGATION_CONTENT_TYPES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const pasteTypes = Object.entries(PASTE_CONTENT_TYPES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const fileTypes = Object.entries(FILE_CONTENT_TYPES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const functions = Object.entries(CEL_FUNCTIONS)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const contexts = Object.entries(CHROME_CONTEXTS)
  .map(([_, v]) => `- '${v.value}': ${v.description}`)
  .join('\n')

const compatibility = Object.entries(CEL_COMPATIBILITY_RULES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const specializedTypes = Object.entries(SPECIALIZED_CONTENT_TYPES)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join('\n')

const actionConstraints = Object.entries(ACTION_PARAMETER_CONSTRAINTS)
  .map(([_, v]) => `- ${v}`)
  .join('\n')

export const doc = {
  title: 'Chrome DLP CEL Condition Reference',
  articleId: '11',
  summary:
    'Exhaustive technical reference for Chrome DLP. Contains the full list of 100+ Predefined Detectors, 200+ Web Categories, CEL syntax, trigger compatibility, and action constraints.',
  content: `# Chrome DLP CEL Condition Reference

This document provides a comprehensive technical reference for writing Common Expression Language (CEL) conditions and configuring actions for Chrome [Data Loss Prevention (DLP) rules](4-dlp-core-features.md).

## 1. CEL Condition Syntax Guide
${syntaxGuide}

---

## 2. Valid Content Types

### Universal
${universalTypes}

### Navigation Only
${navTypes}

### Paste (WEB_CONTENT_UPLOAD) Only
${pasteTypes}

### File (UPLOAD/DOWNLOAD/PRINT) Only
${fileTypes}

### Specialized
${specializedTypes}

---

## 3. Valid Functions
${functions}

---

## 4. Value References

### source_chrome_context
${contexts}

### Full Web Category List (for url_category)
${VALID_WEB_CATEGORIES.join(', ')}.

---

## 5. Predefined Detectors
Use these strings exactly as shown with the \`matches_dlp_detector()\` function:

${PREDEFINED_DETECTORS.join(', ')}.

---

## 6. Common MIME Types (for file_type)
When using \`.matches_mime_types()\`, use standard MIME strings. Common examples:
\`application/pdf\`, \`application/msword\`, \`application/vnd.openxmlformats-officedocument.wordprocessingml.document\`, \`application/vnd.ms-excel\`, \`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\`, \`application/vnd.ms-powerpoint\`, \`application/zip\`, \`text/plain\`, \`image/jpeg\`, \`image/png\`.

---

## 7. Trigger Compatibility Rules
${compatibility}

## 8. Multi-Trigger Logic
If multiple triggers are selected, a field or function is valid if it is supported by AT LEAST ONE of those triggers.
*Example:* 'all_content' is supported if you select both 'URL_NAVIGATION' (which doesn't support it) and 'WEB_CONTENT_UPLOAD' (which does).

---

## 9. Action and Safety Constraints
- **Safety Restriction**: ${MCP_SAFETY_CONSTRAINTS.ACTIVE_BLOCK_RESTRICTION}
${actionConstraints}`,
}
