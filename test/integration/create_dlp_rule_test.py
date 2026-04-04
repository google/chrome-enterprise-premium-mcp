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
        " C0123456 and organizational unit fakeOUId1. Use the trigger"
        " FILE_UPLOAD, action WARN, and condition"
        " 'all_content.contains(\"secret\")'. Give the verbatim error if there"
        " is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )

  def test_create_dlp_rule_with_data_masking(self):
    """Verify agent can create a DLP rule with data masking."""
    prompt = (
        "Create a new DLP rule named 'End-to-End Temp Masking Rule' for"
        " customer C0123456 and organizational unit fakeOUId1. Use the trigger"
        " URL_NAVIGATION, action AUDIT, and condition"
        " 'url.contains(\"secret\")'. Add a data masking"
        " configuration to redact 'policies/akajj264apk5psphei' with display name"
        " 'SSN' and maskType 'MASK_TYPE_REDACT'. Give the verbatim error if"
        " there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )

  def test_create_dlp_rule_download_warning_identifies_tool(self):
    """Verify agent knows which tool to use for a download warning rule."""
    prompt = (
        "Create a rule to add a warning when downloading things from"
        " google.com. Which single tool would you use for this request? Just"
        " name the tool and do nothing else."
    )
    result_text = query_agent_oneshot(prompt)
    self.assertIn("create_chrome_dlp_rule", result_text)

  def test_create_dlp_rule_download_warning(self):
    """Verify agent can actually use the tool when provided needed info."""
    prompt = (
        "Create a Chrome DLP rule to add a warning when downloading things from"
        " google.com for customer C0123456 and organizational unit fakeOUId1."
        " Use trigger FILE_DOWNLOAD and condition"
        " 'url.contains(\"google.com\")'. Give the verbatim error if"
        " there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )

  def test_create_dlp_rule_social_media_audit_identifies_tool(self):
    """Verify agent knows which tool to use for a social media audit rule."""
    prompt = (
        "Create a rule to audit when users visit social media websites. Which"
        " single tool would you use for this request? Just name the tool and"
        " do nothing else."
    )
    result_text = query_agent_oneshot(prompt)
    self.assertIn("create_chrome_dlp_rule", result_text)

  def test_create_dlp_rule_social_media_audit(self):
    """Verify agent can actually use the tool when provided needed info."""
    prompt = (
        "Create a Chrome DLP rule to audit when users visit social media"
        " websites for customer C0123456 and organizational unit fakeOUId1."
        " Use trigger URL_NAVIGATION and action AUDIT, and use the web category"
        " for social networks in the condition. Give the verbatim error if"
        " there is one. IMPORTANT: Do not create a URL list detector or ask"
        " for permission."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )

  def test_create_dlp_rule_block_screenshot_identifies_tool(self):
    """Verify agent knows which tool to use for a block screenshot rule."""
    prompt = (
        "Create a DLP rule to block screenshots on facebook.com. Which single"
        " tool would you use for this request? Just name the tool and do"
        " nothing else."
    )
    result_text = query_agent_oneshot(prompt)
    self.assertIn("create_chrome_dlp_rule", result_text)

  def test_create_dlp_rule_warn_screenshot(self):
    """Verify agent can actually use the tool when provided needed info."""
    prompt = (
        "Create a Chrome DLP rule to block screenshots on facebook.com for"
        " customer C0123456 and organizational unit fakeOUId1. Use trigger"
        " URL_NAVIGATION and action WARN, set blockScreenshot to true, and"
        " condition 'url.contains(\"facebook.com\")'. Give the"
        " verbatim error if there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )

  def test_create_dlp_rule_warn_navigation_identifies_tool(self):
    """Verify agent knows which tool to use for a navigation warning rule."""
    prompt = (
        "Create a DLP rule to warn users visiting yahoo.com. Which single tool"
        " would you use for this request? Just name the tool and do nothing"
        " else."
    )
    result_text = query_agent_oneshot(prompt)
    self.assertIn("create_chrome_dlp_rule", result_text)

  def test_create_dlp_rule_warn_navigation(self):
    """Verify agent can actually use the tool when provided needed info."""
    prompt = (
        "Create a Chrome DLP rule to warn users visiting yahoo.com for"
        " customer C0123456 and organizational unit fakeOUId1. Use trigger"
        " URL_NAVIGATION and action WARN, and condition"
        " 'url.contains(\"yahoo.com\")'. Give the verbatim error if"
        " there is one."
    )
    result_text = query_agent_oneshot(prompt)
    self.assert_nl(
        result_text,
        "The answer confirms that the DLP rule was successfully created",
    )


if __name__ == "__main__":
  unittest.main()
