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

import { it } from 'node:test'
import assert from 'node:assert/strict'
import { buildServerInstructions } from '../../lib/knowledge/instructions.js'

it('When server instructions are built, then they contain the core grounding rules', () => {
  const out = buildServerInstructions()
  assert.match(out, /Chrome Enterprise Premium \(CEP\) Technical Agent/)
  assert.match(out, /Core Protocol: Grounding \+ Diagnostics/)
})

it('When server instructions are built, then they include the agent capabilities contract', () => {
  const out = buildServerInstructions()
  assert.match(out, /AI Agent Capabilities and Limitations/)
})

it('When server instructions are built, then they do NOT inline the Knowledge Index', () => {
  const out = buildServerInstructions()
  assert.doesNotMatch(out, /### Knowledge Index/)
})
