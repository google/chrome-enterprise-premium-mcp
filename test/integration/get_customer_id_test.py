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


class TestGetCustomerId(McpIntegrationTestBase):

  def test_get_customer_id(self):
    """Verify agent can retrieve the customer ID."""
    prompt = "What is my customer ID?"
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text, "The answer includes the customer ID 'C02gbfv3o'"
    )


if __name__ == "__main__":
  unittest.main()
