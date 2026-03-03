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

import os
import signal
import socket
import subprocess
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request

import requests
import test.helpers.mcp_client
from test.helpers.mcp_client import execute_mcp_tool


def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('localhost', 0))
        return s.getsockname()[1]

class TestExecuteMcpToolIntegration(unittest.TestCase):

  @classmethod
  def setUpClass(cls):
    print("--- Setting up MCP Server for Integration Test ---")
    cls.server_process = None
    cls.server_port = get_free_port()
    test.helpers.mcp_client.MCP_SERVER_URL = f"http://localhost:{cls.server_port}/mcp"
    url_parts = urllib.parse.urlparse(test.helpers.mcp_client.MCP_SERVER_URL)
    mcp_server_path = os.path.join(
        os.path.dirname(__file__), "../../mcp-server.js"
    )
    if not os.path.exists(mcp_server_path):
      raise FileNotFoundError(
          f"MCP server script not found at {mcp_server_path}"
      )
    env = os.environ.copy()
    env["GCP_STDIO"] = "false"
    env["OAUTH_ENABLED"] = "false"
    env["PORT"] = str(cls.server_port)
    try:
      print(
          f"Starting MCP server: node {mcp_server_path} on port"
          f" {cls.server_port}"
      )
      cls.server_process = subprocess.Popen(
          ["node", mcp_server_path],
          env=env,
          stdout=subprocess.PIPE,
          stderr=subprocess.PIPE,
          preexec_fn=os.setsid,
          text=True,
      )
      max_wait = 20
      start_time = time.time()
      server_ready = False
      health_url = f"http://localhost:{cls.server_port}/"
      print(f"Waiting for server to become ready at {health_url}...")
      while time.time() - start_time < max_wait:
        try:
          with urllib.request.urlopen(health_url, timeout=1) as response:
            pass  # If we get here, any response means it's up
        except urllib.error.HTTPError as e:
          if e.code == 404:  # Default express not found is fine
            print("Server is up (got 404 for /)")
            server_ready = True
            break
          else:
            print(f"Server check GET / received HTTP Error {e.code}")
        except (urllib.error.URLError, TimeoutError, ConnectionRefusedError):
          time.sleep(0.5)
        except Exception as e:
          print(f"Unexpected error during server check: {e}")
          time.sleep(0.5)
      if not server_ready:
        cls.terminate_server()
        raise RuntimeError(
            f"MCP server did not start within {max_wait} seconds."
        )
      print("MCP server started successfully.")
    except Exception as e:
      cls.terminate_server()
      raise RuntimeError(f"Failed to start MCP server: {e}")

  @classmethod
  def terminate_server(cls):
    if cls.server_process and cls.server_process.pid:
      print("Terminating MCP server...")
      try:
        os.killpg(os.getpgid(cls.server_process.pid), signal.SIGTERM)
        cls.server_process.wait(timeout=10)
        print("Server process terminated.")
      except subprocess.TimeoutExpired:
        print("Server did not stop gracefully, killing...")
        os.killpg(os.getpgid(cls.server_process.pid), signal.SIGKILL)
      except ProcessLookupError:
        print("Server process already stopped.")
      except Exception as e:
        print(f"Error stopping server: {e}")
      finally:
        if cls.server_process:
          if cls.server_process.stdout:
            stdout = cls.server_process.stdout.read()
            if stdout:
              print(f"Server stdout:\n{stdout}")
            cls.server_process.stdout.close()
          if cls.server_process.stderr:
            stderr = cls.server_process.stderr.read()
            if stderr:
              print(f"Server stderr:\n{stderr}")
            cls.server_process.stderr.close()
          cls.server_process = None
    print("--- MCP Server Teardown Complete ---")

  @classmethod
  def tearDownClass(cls):
    cls.terminate_server()

  def test_execute_get_customer_id_success(self):
    """Test calling get_customer_id tool, expecting a successful result or a specific error if auth fails."""
    tool_name = "get_customer_id"
    args = {}
    result = execute_mcp_tool(tool_name, args)
    self.assertNotIn("Failed to parse server response", result.get("error", ""))
    self.assertNotIsInstance(
        result.get("error", ""), requests.exceptions.RequestException
    )
    if "error" in result:
      self.assertIn(f"Tool {tool_name} failed", result["error"])
    else:
      # If successful, we expect a 'Customer ID: C...' string or an auth error in the content
      text_content = result.get("content", [{}])[0].get("text", "")
      self.assertTrue(
          "Customer ID: C" in text_content or "invalid_grant" in text_content,
          f"Result: {result}",
      )

  def test_execute_list_dlp_rules_success(self):
    """Test calling list_dlp_rules tool."""
    tool_name = "list_dlp_rules"
    args = {"type": "rule"}
    result = execute_mcp_tool(tool_name, args)
    self.assertNotIn("Failed to parse server response", result.get("error", ""))
    self.assertNotIsInstance(
        result.get("error", ""), requests.exceptions.RequestException
    )
    if "error" in result:
      self.assertIn(f"Tool {tool_name} failed", result["error"])
    else:
      self.assertIsInstance(result.get("content"), list)

  def test_execute_nonexistent_tool(self):
    """Test calling a tool that does not exist on the MCP server."""
    tool_name = "this_tool_does_not_exist"
    args = {}
    result = execute_mcp_tool(tool_name, args)
    result_str = str(result)
    self.assertIn(
        "-32602", result_str
    )  # JSON-RPC error code for Method not found
    self.assertIn("Tool this_tool_does_not_exist not found", result_str)


if __name__ == "__main__":
  unittest.main()
