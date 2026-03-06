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

import unittest

from test.helpers.integration_test_base import McpIntegrationTestBase
from test.helpers.langchain_agent import query_agent_oneshot


class TestCreateDetector(McpIntegrationTestBase):

  def test_create_url_list_detector(self):
    """Verify agent can create a URL list detector."""
    prompt = "Create a new DLP URL list detector named 'End-to-End Temp Detector' for customer C0123456 with URLs 'malware.com' and 'phishing.net'. Give verbatim error if there is one."
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text, "The answer confirms that the 'End-to-End Temp Detector' detector was successfully created"
    )

  def test_create_word_list_detector(self):
    """Verify agent can create a word list detector."""
    prompt = "Create a new DLP word list detector named 'End-to-End Temp Word List' for customer C0123456 with words 'secret'."
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text, "The answer confirms that the 'End-to-End Temp Word List' detector was successfully created"
    )

  def test_create_regex_detector(self):
    """Verify agent can create a regular expression detector."""
    prompt = "Create a new DLP regular expression detector named 'End-to-End Temp Regex' for customer C0123456 with expression '^4[0-9]{12}(?:[0-9]{3})?$'."
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text, "The answer confirms that a regular expression detector was successfully created"
    )

if __name__ == "__main__":
  unittest.main()
