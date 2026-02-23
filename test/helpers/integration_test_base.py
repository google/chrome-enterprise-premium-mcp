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
import sys
import threading
import time
import unittest

import requests
import test.helpers.mcp_client
from test.helpers.mcp_server_runner import start_mcp_server
from test.helpers.mcp_server_runner import terminate_mcp_server
from test.helpers.nl_check import assert_nl_condition


def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('localhost', 0))
        return s.getsockname()[1]

def capture_output(process, stream_name):
    try:
        stream = process.stdout if stream_name == 'stdout' else process.stderr
        if stream:
            for line in iter(stream.readline, b''):
                if line:
                    print(f"[FAKE API {stream_name.upper()}] {line.decode('utf-8').strip()}", flush=True)
                else:
                    break
    except ValueError:
        pass # Stream closed
    except Exception as e:
        print(f"[FAKE API {stream_name.upper()}] Error reading stream: {e}", flush=True)

class McpIntegrationTestBase(unittest.TestCase):
    """Base class for MCP integration tests that manages the MCP server lifecycle."""

    mcp_server_process = None
    fake_api_process = None
    fake_api_stdout_thread = None
    fake_api_stderr_thread = None

    @classmethod
    def setUpClass(cls):
        """Starts the Fake API and MCP server once before any tests."""
        super().setUpClass()
        # Get free ports dynamically
        cls.FAKE_API_PORT = get_free_port()
        cls.FAKE_API_URL = f"http://localhost:{cls.FAKE_API_PORT}"

        mcp_server_port = get_free_port()
        test.helpers.mcp_client.MCP_SERVER_URL = f"http://localhost:{mcp_server_port}/mcp"

        # Attempt to kill any lingering processes on the port (though less likely needed now)
        cls._kill_process_on_port(cls.FAKE_API_PORT)
        cls._kill_process_on_port(mcp_server_port)

        cls._start_fake_api()
        cls.mcp_server_process = start_mcp_server(fake_api_url=cls.FAKE_API_URL, server_port=mcp_server_port)

    @classmethod
    def tearDownClass(cls):
        """Stops the MCP server and Fake API once after all tests."""
        terminate_mcp_server(cls.mcp_server_process)
        cls._stop_fake_api()
        if cls.fake_api_stdout_thread:
            cls.fake_api_stdout_thread.join(timeout=2)
        if cls.fake_api_stderr_thread:
            cls.fake_api_stderr_thread.join(timeout=2)
        super().tearDownClass()

    @classmethod
    def _kill_process_on_port(cls, port):
        print(f"--- Attempting to free port {port} ---", flush=True)
        try:
            # Command to find and kill the process using the port
            cmd = f"lsof -i tcp:{port} | awk 'NR!=1 {{print $2}}' | xargs kill -9"
            subprocess.run(cmd, shell=True, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            time.sleep(0.5) # Give a moment for the port to be released
            print(f"--- Port {port} should be free ---", flush=True)
        except Exception as e:
            print(f"--- Warning: Failed to kill process on port {port}: {e} ---", flush=True)

    @classmethod
    def _start_fake_api(cls):
        print("--- Starting Fake CEP API Server ---", flush=True)
        fake_api_path = os.path.join(os.path.dirname(__file__), "fake_cep_api_server.py")
        if not os.path.exists(fake_api_path):
            raise FileNotFoundError(f"Fake API script not found at {os.path.abspath(fake_api_path)}")

        env = os.environ.copy()
        env["PORT"] = str(cls.FAKE_API_PORT)

        cls.fake_api_process = subprocess.Popen(
            [sys.executable, "-u", fake_api_path],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid # Run in a new session
        )

        cls.fake_api_stdout_thread = threading.Thread(target=capture_output, args=(cls.fake_api_process, 'stdout'))
        cls.fake_api_stderr_thread = threading.Thread(target=capture_output, args=(cls.fake_api_process, 'stderr'))
        cls.fake_api_stdout_thread.start()
        cls.fake_api_stderr_thread.start()

        max_wait = 20
        start_time = time.time()
        health_url = f"{cls.FAKE_API_URL}/docs"
        for i in range(max_wait):
            try:
                response = requests.get(health_url, timeout=1)
                if response.status_code == 200:
                    print(f"Fake CEP API Server started successfully on {cls.FAKE_API_URL}", flush=True)
                    return
            except requests.exceptions.ConnectionError:
                time.sleep(1)
            except requests.exceptions.RequestException as e:
                 print(f"Error checking Fake CEP API health: {e}", flush=True)
                 time.sleep(1)

        print("Fake CEP API Server did not become healthy in time.", flush=True)
        cls._stop_fake_api()
        raise RuntimeError(f"Fake CEP API server did not start within {max_wait} seconds.")

    @classmethod
    def _stop_fake_api(cls):
        if cls.fake_api_process and cls.fake_api_process.pid:
            print("--- Stopping Fake CEP API Server ---", flush=True)
            try:
                # Kill the entire process group
                os.killpg(os.getpgid(cls.fake_api_process.pid), signal.SIGTERM)
                cls.fake_api_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("--- Fake API Server did not stop gracefully, killing group ---", flush=True)
                os.killpg(os.getpgid(cls.fake_api_process.pid), signal.SIGKILL)
            except ProcessLookupError:
                 print("--- Fake API Server process already stopped. ---", flush=True)
            except Exception as e:
                print(f"--- Error stopping Fake API Server: {e} ---", flush=True)
            finally:
                if cls.fake_api_process:
                    if cls.fake_api_process.stdout: cls.fake_api_process.stdout.close()
                    if cls.fake_api_process.stderr: cls.fake_api_process.stderr.close()
                cls.fake_api_process = None
                print("--- Fake API Server stop complete ---", flush=True)

    def setUp(self):
        """Resets the fake API state before each test."""
        super().setUp()
        try:
            reset_url = f"{self.FAKE_API_URL}/test/reset"
            response = requests.post(reset_url, timeout=5)
            response.raise_for_status()
            print(f"Fake CEP API state reset: {response.json()}", flush=True)
        except requests.exceptions.RequestException as e:
            print(f"Warning: Failed to reset fake CEP API state: {e}", flush=True)
            self.fail(f"Could not reset fake CEP API state: {e}")

    def assert_nl(self, text, condition):
        """Helper method for natural language assertions."""
        assert_nl_condition(text, condition)
