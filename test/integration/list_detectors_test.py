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


class TestListDetectors(McpIntegrationTestBase):

  def test_list_detectors(self):
    """Verify agent can list DLP detectors."""
    prompt = "Can you list my DLP detectors?"
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text, "The answer mentions 'Fake URL Detector'"
    )


if __name__ == "__main__":
  unittest.main()
