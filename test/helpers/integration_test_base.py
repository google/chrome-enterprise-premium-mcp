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

from test.helpers.mcp_server_runner import start_mcp_server
from test.helpers.mcp_server_runner import terminate_mcp_server
from test.helpers.nl_check import assert_nl_condition


class McpIntegrationTestBase(unittest.TestCase):
  """Base class for MCP integration tests that manages the MCP server lifecycle."""

  server_process = None

  @classmethod
  def setUpClass(cls):
    """Starts the MCP server once before any tests in the class run."""
    super().setUpClass()
    cls.server_process = start_mcp_server()

  @classmethod
  def tearDownClass(cls):
    """Stops the MCP server once after all tests in the class have run."""
    terminate_mcp_server(cls.server_process)
    super().tearDownClass()

  def assert_nl(self, text, condition):
    """Helper method for natural language assertions."""
    assert_nl_condition(text, condition)
