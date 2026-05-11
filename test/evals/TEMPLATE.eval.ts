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

/*
Copy this file to test/evals/cases/<category>/<id>.eval.js, then fill it in.

Required:
  id              Snake_case or short alphanumeric. Must be unique across the suite.
                  This is the key the drift comparator uses, so once a case is in the
                  baseline, do not rename it without coordinating a baseline refresh.
  prompt          OR promptName. The user input. promptName fetches a server-defined
                  MCP prompt at runtime.
  goldenResponse  What a correct response looks like. The judge compares semantically,
                  not word-for-word.

Optional:
  priority        'P0' | 'P1' | 'P2'. Default 'P2'.
  tags            string[] for filtering with --tags.
  scenario        Name of a scenario file in test/evals/scenarios/. Replaces fake-server
                  state. Mutually exclusive with fixtures.
  fixtures        string[] of JSON file paths in test/evals/fixtures/. Merged into state.
  expectedTools   string[]. Each must be called by the agent during the run.
  forbiddenPatterns          string[]. Substring or 're:<regex>'. Merged with global list.
  forbiddenPatternsOverride  boolean. Replace global list instead of merging.
  requiredPatterns           string[]. Use only for canonical strings (proper nouns,
                             numbers, exact URLs). Use the judge for paraphrasable claims.
  judgeInstructions          string. Per-case rubric override. If absent, the default
                             rubric from global.yaml is used.
  experiments                object. Pin feature-flag values for the run, e.g.
                             { DELETE_TOOL_ENABLED: false }.

Category is derived from the parent directory name — there is no category field.

See docs/evals/format.md for the full spec.
*/

export default {
  id: 'TEMPLATE_REPLACE_ME',
  priority: 'P2',
  tags: [],
  scenario: 'healthy',
  expectedTools: [],
  prompt: 'Replace this with the user prompt.',
  goldenResponse: 'Replace this with what a correct response covers.',
  judgeInstructions: 'Replace or delete this. If deleted, the default rubric applies.',
}
