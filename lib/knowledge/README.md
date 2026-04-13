<!--
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
-->

# lib/knowledge

Built-in Chrome Enterprise Premium knowledge base. The `search_content` tool
searches these articles by keyword; `get_document` returns an article's full
text by ID. Articles are loaded lazily on first tool call and cached in memory
for the session.

## Article format

Each file is a Markdown document with YAML frontmatter:

```yaml
---
title: 'Human-readable title'
summary: 'One-line summary returned by search_content results'
articleId: 4
kind: curated
url: 'https://support.google.com/...'
---
# Article body

Full content returned by get_document.
```

**File naming:** `{articleId}-{slug}.md`. The numeric prefix is the `articleId`
used by `get_document`.

**Frontmatter fields:**

| Field       | Required | Description                                                                              |
| :---------- | :------- | :--------------------------------------------------------------------------------------- |
| `title`     | Yes      | Display title in search results                                                          |
| `summary`   | Yes      | Brief description returned alongside search hits                                         |
| `articleId` | Yes      | Numeric ID for `get_document` lookup                                                     |
| `kind`      | No       | Content type (`curated`, `helpcenter`, `cloud-docs`, `policies`). Defaults to `curated`. |
| `url`       | No       | Link to the canonical source document                                                    |

## Special article: 0-agent-capabilities.md

Article 0 is not just searchable — it is injected alongside the system prompt on
the agent's first tool call (via `tools/utils/wrapper.js`). It defines what the
agent can and cannot do, which grounds the agent's behavior from the first
interaction.

## Adding a new article

Create a `.md` file with the next available `articleId`, add YAML frontmatter,
and write the content. No code changes are needed — the loader discovers files
from this directory at runtime.
