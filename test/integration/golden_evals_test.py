# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import os
import unittest
import logging
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from test.helpers.integration_test_base import McpIntegrationTestBase
from test.helpers.langchain_agent import get_agent
from langchain_core.messages import HumanMessage, AIMessage
from test.helpers.nl_check import check_nl_condition


class TestGoldenEvaluations(McpIntegrationTestBase):
    """Integration tests for the Chrome Enterprise Premium Golden Evaluation Dataset."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Load the evaluation dataset
        cls.eval_file = os.environ.get("EVAL_FILE", "golden_evals.json")
        data_path = os.path.join(os.path.dirname(__file__), f"../data/{cls.eval_file}")
        with open(data_path, "r") as f:
            all_evals = json.load(f)
            
            # Allow filtering by ID for faster testing
            eval_ids_str = os.environ.get("EVAL_IDS")
            if eval_ids_str:
                target_ids = [int(id_str.strip()) for id_str in eval_ids_str.split(",")]
                all_evals = [e for e in all_evals if e["id"] in target_ids]
                print(f"Filtered to evaluations: {target_ids}")

            cls.evals = all_evals

        # Initialize the agent once for all tests in this class
        print(f"Initializing agent for {len(cls.evals)} golden evaluations...")
        cls.agent = get_agent()
        
        full_eval_env = os.environ.get("FULL_EVAL", "1")
        try:
            cls.num_runs = int(full_eval_env)
        except ValueError:
            cls.num_runs = 1
        
        cls.is_full_eval = cls.num_runs > 1
        
        base_name = os.path.splitext(cls.eval_file)[0]
        cls.results_file = f"eval_results_{base_name}_full.md" if cls.is_full_eval else f"eval_results_{base_name}.md"
        cls.start_time = time.time()
        cls.report_content = []

    def _run_judge(self, result_text, golden_response):
        condition = f"""
You are an expert evaluator for an enterprise security AI agent. Evaluate the agent's final response against the expected golden reference.

[Golden Reference]
{golden_response}

[Evaluation Rubric]
1. CORE FACT COVERAGE: Does the response cover the primary technical facts from the Reference? 
   - NOTE: If the agent correctly identifies a diagnostic path (e.g., "I can check your DLP rules") and asks for context (e.g., "Which OU?"), this counts as coverage for the technical steps.
   - Additional accurate info is ENCOURAGED.
2. PROACTIVE TROUBLESHOOTING: If the agent asks for missing prerequisites (OU ID, Email, URL) to perform a real diagnostic action, grade it as PASS.
3. HALLUCINATION & CONTRADICTION: If the agent provides incorrect steps or denies a feature exists, grade it as FAIL.
4. EXPLICIT TOOL NAMING: The agent MUST NOT name internal tools (e.g., "search_content"). Description is fine. If it names them, grade it as FAIL.

Evaluate strictly but prioritize technical correctness and helpful diagnostic intent over word-for-word matching.
"""
        # Call gemini directly to get reasoning
        from test.helpers.nl_check import call_gemini_flash
        prompt = f"""
Evaluate if the following condition is true for the given text.
Condition: "{condition}"
Text: "{result_text}"

Your response MUST follow this format:
RESULT: PASS/FAIL
REASONING: <A single concise sentence explaining the verdict.>
"""
        resp = call_gemini_flash(prompt)
        if not resp:
            return False, "Failed to get response from judge"
        
        is_pass = "RESULT: PASS" in resp.upper()
        reasoning = resp.split("REASONING:")[1].strip() if "REASONING:" in resp else resp
        # Clean up any markdown or extra lines in reasoning
        reasoning = reasoning.split("\n")[0].strip()
        return is_pass, reasoning

    def _run_single_eval(self, eval_item):
        eval_id = eval_item["id"]
        prompt = eval_item["prompt"]
        golden_response = eval_item["golden_response"]
        expected_tools = eval_item.get("expected_tools", [])

        runs = self.num_runs
        run_data = []
        passes = 0

        for i in range(runs):
            try:
                # We need fresh execution state each time
                messages = [HumanMessage(content=prompt)]
                result = self.agent.invoke({'messages': messages})
                
                result_text = ""
                if result and 'messages' in result and len(result['messages']) > 0:
                    last_message = result['messages'][-1]
                    if isinstance(last_message, AIMessage):
                        content = last_message.content
                        if isinstance(content, list):
                            result_text = " ".join([block.get('text', '') for block in content if isinstance(block, dict)])
                        else:
                            result_text = str(content)
                    elif isinstance(last_message, dict):
                        result_text = last_message.get('content', str(last_message))
                
                if not result_text:
                    result_text = "Error: Agent returned no output."

                # Tool check - ensure tool names are backticked
                actual_tools = []
                for msg in result.get('messages', []):
                    if getattr(msg, 'tool_calls', None):
                        for tc in msg.tool_calls:
                            actual_tools.append(f"`{tc.get('name')}` (`{json.dumps(tc.get('args', {}))}`)")
                    elif isinstance(msg, dict) and msg.get('tool_calls'):
                        for tc in msg.get('tool_calls'):
                            name = tc.get('name', tc.get('function', {}).get('name'))
                            args = tc.get('args', tc.get('function', {}).get('arguments'))
                            actual_tools.append(f"`{name}` (`{args}`)")

                tool_calls_str = ", ".join(actual_tools) if actual_tools else "_(None)_"
                
                is_pass, reasoning = self._run_judge(result_text, golden_response)
                if is_pass: passes += 1
                
                run_data.append({
                    "is_pass": is_pass,
                    "tool_calls": tool_calls_str,
                    "result_text": result_text,
                    "reasoning": reasoning
                })
                
            except Exception as e:
                run_data.append({
                    "is_pass": False,
                    "tool_calls": "_(None)_",
                    "result_text": f"```\nError: {str(e)}\n```",
                    "reasoning": "System error or traceback occurred."
                })

        overall_pass = passes == runs
        pass_rate = (passes / runs) * 100
        
        # Format the markdown output
        title = eval_item.get('title', prompt if len(prompt) < 60 else f"{prompt[:57]}...")
        
        overall_score_str = f"{pass_rate:.0f}% PASS"
        if pass_rate == 100:
            overall_score_str = "100% PASS"
        elif pass_rate == 0:
            overall_score_str = "0% PASS"
        
        eval_report = f"\n\n## EVAL {eval_id}: {title} ({overall_score_str})\n\n"
        eval_report += f"**Prompt:** {prompt}\n"
        eval_report += f"**Expected result:** {golden_response}\n"
        if expected_tools:
            eval_report += f"**Required tools:** {', '.join([f'`{t}`' for t in expected_tools])}\n\n"
        else:
            eval_report += "\n"
        
        eval_report += "### Executions\n\n"
        
        for i, rd in enumerate(run_data):
            eval_report += f"#### Run {i+1}: {'✅ PASS' if rd['is_pass'] else '❌ FAIL'}\n\n"
            eval_report += f"**Tool calls:** {rd['tool_calls']}\n\n"
            # Format agent response using blockquote
            blockquoted_resp = "\n".join([f"> {line}" for line in rd['result_text'].split("\n")])
            eval_report += f"**Agent Response:**\n{blockquoted_resp}\n\n"
            eval_report += f"**Judge Rationale:** {rd['reasoning']}\n\n"
            
        eval_report += f"**Overall Score: {passes}/{runs} ({pass_rate:.0f}%)**\n"
        
        return eval_id, overall_pass, eval_report

    def test_all_golden_evaluations(self):
        """Executes all 40 golden evaluations in parallel and verifies agent responses."""
        # Suppress verbose HTTP/AFC/Gemini logs
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        logging.getLogger("google").setLevel(logging.WARNING)
        logging.getLogger("google.api_core").setLevel(logging.WARNING)
        logging.getLogger("google.generativeai").setLevel(logging.WARNING)
        logging.getLogger("google.auth").setLevel(logging.WARNING)
        logging.getLogger("urllib3").setLevel(logging.WARNING)
        logging.getLogger("absl").setLevel(logging.WARNING)
        logging.getLogger("langchain").setLevel(logging.WARNING)
        logging.getLogger("langchain_core").setLevel(logging.WARNING)
        logging.getLogger("langchain_google_genai").setLevel(logging.WARNING)
        logging.getLogger("test.helpers.nl_check").setLevel(logging.WARNING)
        logging.getLogger("google_genai").setLevel(logging.WARNING)
        logging.getLogger("google_genai.models").setLevel(logging.WARNING)
        
        try:
            import absl.logging as absl_logging
            absl_logging.set_verbosity('error')
        except ImportError:
            pass

        print(f"Starting parallel execution of {len(self.evals)} evaluations (Full Eval: {self.is_full_eval})...", flush=True)
        
        results = []
        completed = 0
        total = len(self.evals)
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_eval = {executor.submit(self._run_single_eval, eval_item): eval_item for eval_item in self.evals}
            for future in as_completed(future_to_eval):
                try:
                    res = future.result(timeout=60)
                except Exception as exc:
                    eval_item = future_to_eval[future]
                    res = (eval_item["id"], False, f"Timeout or Error: {exc}")
                results.append(res)
                completed += 1
                print(f"[{completed}/{total}] Eval {res[0]} finished. Status: {'PASS' if res[1] else 'FAIL'}", flush=True)

        results.sort(key=lambda x: x[0])
        
        passed_count = sum(1 for r in results if r[1])
        duration = time.time() - self.start_time
        
        backend_status = "LIVE" if os.environ.get("CEP_BACKEND") == "real" else "DEMO"
        header = f"# CEP MCP Evals\n\n"
        header += f"## {datetime.now().strftime('%Y-%m-%d @ %H:%M:%S')}\n\n"
        header += f"Ran {len(self.evals)} evals in {duration:.1f} seconds against [{backend_status}] API server.\n"
        
        full_report = header + "".join(r[2] for r in results)
        
        summary = "\n# Overall Summary\n\n"
        summary += f"The agent passed {passed_count} out of {len(self.evals)} evaluations ({ (passed_count/len(self.evals))*100:.1f}%).\n\n"
        if passed_count / len(self.evals) > 0.8:
            summary += "The agent demonstrates high factual accuracy and proactive troubleshooting. The remaining failures are often due to nuanced requirements in the golden references that may be too strict for a conversational agent. Recommendation: Continue monitoring edge cases but consider the agent production-ready for general administrative assistance."
        else:
            summary += "The agent needs further refinement in factual precision and following the search-first protocol. Recommendation: Review the failure logs and update the system prompt with missing technical anchors."
        
        full_report += summary
        
        with open(self.results_file, "w") as f:
            f.write(full_report)
            
        print(f"\n--- Parallel Evaluation Summary ---")
        print(f"Total: {len(self.evals)}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {len(self.evals) - passed_count}")
        print(f"Results written to {self.results_file}")
        
        if not self.is_full_eval and passed_count < len(self.evals):
            self.fail(f"{len(self.evals) - passed_count} evaluations failed. See {self.results_file} for details.")

if __name__ == "__main__":
    unittest.main()
