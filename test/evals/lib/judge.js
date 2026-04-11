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
 * @file Gemini-as-judge for semantic eval grading.
 *
 * Replaces the Python nl_check.py + _run_judge pattern. Uses
 * \@google/generative-ai (Google's own SDK).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-2.5-flash'

/**
 * Creates a judge instance backed by Gemini.
 * @param {string} apiKey - Gemini API key.
 * @param {string} [baseUrl] - Optional base URL for the Gemini API.
 * @returns {{ judge: JudgeFn }}
 */
export function createJudge(apiKey, baseUrl) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for the eval judge.')
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL_NAME }, { baseUrl })

  /**
   * @param {object} opts
   * @param {string} opts.responseText - Agent's response to evaluate.
   * @param {string} opts.goldenResponse - Expected golden reference.
   * @param {string} opts.rubric - Judge rubric (per-eval or default).
   * @returns {Promise<{ passed: boolean, reasoning: string }>}
   */
  async function judge({ responseText, goldenResponse, rubric }) {
    const prompt = `You are an expert evaluator for an enterprise security AI agent. Evaluate the agent's final response against the expected golden reference.

[Golden Reference]
${goldenResponse}

[Evaluation Rubric]
${rubric}

Evaluate strictly but prioritize technical correctness and helpful diagnostic intent over word-for-word matching.

[Agent Response]
${responseText}

Your response MUST follow this exact format:
RESULT: PASS/FAIL
REASONING: <A single concise sentence explaining the verdict.>`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()

      const isPassed = text.toUpperCase().includes('RESULT: PASS')
      let reasoning = text
      const reasoningMatch = text.match(/REASONING:\s*(.+)/i)
      if (reasoningMatch) {
        reasoning = reasoningMatch[1].trim().split('\n')[0].trim()
      }

      return { passed: isPassed, reasoning }
    } catch (err) {
      return { passed: false, reasoning: `Judge error: ${err.message}` }
    }
  }

  return { judge }
}

/**
 * @callback JudgeFn
 * @param {{ responseText: string, goldenResponse: string, rubric: string }} opts
 * @returns {Promise<{ passed: boolean, reasoning: string }>}
 */
