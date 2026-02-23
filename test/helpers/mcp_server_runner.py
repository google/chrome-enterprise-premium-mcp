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
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

from .mcp_client import MCP_SERVER_URL

def start_mcp_server(fake_api_url=None, server_port=None):
    print("--- Setting up MCP Server ---")
    server_process = None
    if server_port is None:
        server_port = 3000
        url_parts = urllib.parse.urlparse(MCP_SERVER_URL)
        if url_parts.port:
            server_port = url_parts.port

    mcp_server_path = os.path.join(
        os.path.dirname(__file__), "../../mcp-server.js"
    )
    if not os.path.exists(mcp_server_path):
        raise FileNotFoundError(
            f"MCP server script not found at {os.path.abspath(mcp_server_path)}"
        )

    env = os.environ.copy()
    env["GCP_STDIO"] = "false"
    env["PORT"] = str(server_port)
    if fake_api_url:
        env["GOOGLE_API_ROOT_URL"] = fake_api_url
        print(f"--- MCP Server will use Fake Google API at: {fake_api_url} ---")

    try:
        print(f"Starting MCP server: node {mcp_server_path} on port {server_port}")
        server_process = subprocess.Popen(
            ["node", mcp_server_path],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid,
            text=True,
        )
        # ... rest of the health check logic ...
        max_wait = 20
        start_time = time.time()
        server_ready = False
        health_url = f"http://localhost:{server_port}/" # MCP server health
        print(f"Waiting for MCP server to become ready at {health_url}...")
        while time.time() - start_time < max_wait:
            try:
                with urllib.request.urlopen(health_url, timeout=1):
                    pass
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    print("MCP Server is up (got 404 for /)")
                    server_ready = True
                    break
                else:
                    print(f"MCP Server check GET / received HTTP Error {e.code}")
            except (urllib.error.URLError, TimeoutError, ConnectionRefusedError):
                time.sleep(0.5)
            except Exception as e:
                print(f"Unexpected error during MCP server check: {e}")
                time.sleep(0.5)

        if not server_ready:
            if server_process:
                terminate_mcp_server(server_process)
            raise RuntimeError(f"MCP server did not start within {max_wait} seconds.")
        print("MCP server started successfully.")
        return server_process

    except Exception as e:
        if server_process:
            terminate_mcp_server(server_process)
        raise RuntimeError(f"Failed to start MCP server: {e}")

def terminate_mcp_server(server_process):
    if server_process and server_process.pid:
        print("Terminating MCP server...")
        try:
            os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)
            server_process.wait(timeout=10)
            print("Server process terminated.")
        except subprocess.TimeoutExpired:
            print("Server did not stop gracefully, killing...")
            os.killpg(os.getpgid(server_process.pid), signal.SIGKILL)
        except ProcessLookupError:
            print("Server process already stopped.")
        except Exception as e:
            print(f"Error stopping server: {e}")
        finally:
            if server_process and server_process.stdout:
                stdout = server_process.stdout.read()
                if stdout:
                    print(f"MCP Server stdout:\n{stdout}")
                server_process.stdout.close()
            if server_process and server_process.stderr:
                stderr = server_process.stderr.read()
                if stderr:
                    print(f"MCP Server stderr:\n{stderr}")
                server_process.stderr.close()
    print("--- MCP Server Teardown Complete ---")
