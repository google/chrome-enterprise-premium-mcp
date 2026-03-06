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


class TestCreateDlpRule(McpIntegrationTestBase):

  def test_create_dlp_rule(self):
    """Verify agent can create a DLP rule."""
    prompt = (
        "Create a new DLP rule named 'End-to-End Temp DLP Rule' for customer"
        " C0123456 and OrgUnit fakeOUId1. Use the trigger FILE_UPLOAD, action"
        " WARN, and condition 'all_content.contains(\"secret\")'. Give"
        " verbatim error if there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the 'End-to-End Temp DLP Rule' DLP rule was"
        " successfully created",
    )

  def test_create_dlp_rule_with_data_masking(self):
    """Verify agent can create a DLP rule with data masking."""
    prompt = (
        "Create a new DLP rule named 'End-to-End Temp Masking Rule' for"
        " customer C0123456 and OrgUnit fakeOUId1. Use the trigger NAVIGATION,"
        " action AUDIT, and condition 'all_content.contains(\"secret\")'."
        " Add a data masking configuration to redact US_SOCIAL_SECURITY_NUMBER"
        " with display name 'SSN' and maskType 'MASK_TYPE_REDACT'. Give"
        " verbatim error if there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the 'End-to-End Temp Masking Rule' DLP rule"
        " was successfully created",
    )


if __name__ == "__main__":
  unittest.main()
