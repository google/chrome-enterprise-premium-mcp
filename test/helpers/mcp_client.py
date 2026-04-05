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
import logging
import os
from typing import Any, Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# MCP Server URL
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:3000/mcp")


def _parse_sse_response(response_text: str) -> Optional[dict[str, Any]]:
  """Parses JSON from an SSE response string.

  Args:
    response_text: The raw response text from the server.

  Returns:
    A dictionary parsed from the JSON data, or None if parsing fails.
  """
  if not response_text:
    return None
  data_line = None
  for line in response_text.strip().split("\n"):
    if line.startswith("data: "):
      data_line = line[6:]
      break
  if data_line:
    try:
      return json.loads(data_line)
    except json.JSONDecodeError:
      logging.error(
          "Failed to decode JSON from data line: %s", data_line, exc_info=True
      )
      return None
  else:
    # Fallback for non-SSE JSON
    try:
      return json.loads(response_text)
    except json.JSONDecodeError:
      logging.error(
          "Failed to decode JSON from response: %s", response_text, exc_info=True
      )
      return None


def serialize_pydantic(v: Any) -> Any:
    """Recursively serializes Pydantic models to dicts."""
    if hasattr(v, 'model_dump'):
        return v.model_dump()
    elif isinstance(v, dict):
        return {key: serialize_pydantic(val) for key, val in v.items()}
    elif isinstance(v, list):
        return [serialize_pydantic(item) for item in v]
    else:
        return v

def execute_mcp_tool(tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
  """Executes a specific tool on the MCP server.

  Args:
    tool_name: The name of the tool to execute.
    args: A dictionary of arguments for the tool.

  Returns:
    A dictionary containing the tool's result or an error description.
  """
  serialized_args = serialize_pydantic(args)
  payload = {
      "jsonrpc": "2.0",
      "method": "tools/call",
      "id": f"test-{tool_name}-{os.urandom(4).hex()}",
      "params": {"name": tool_name, "arguments": serialized_args},
  }
  headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
  }
  try:
    response = requests.post(
        MCP_SERVER_URL, json=payload, headers=headers, timeout=20
    )
    response.raise_for_status()
    response_text = response.text
    response_json = _parse_sse_response(response_text)

    if response_json is None:
      return {
          "error": "Failed to parse server response",
          "details": response_text,
      }

    if "error" in response_json:
      logging.error(
          "MCP Tool '%s' failed with JSON-RPC error: %s",
          tool_name,
          json.dumps(response_json['error'])
      )
      return {
          "error": (
              f"Tool {tool_name} failed:"
              f" {response_json['error'].get('message', 'Unknown error')}"
          ),
          "details": response_json["error"],
      }

    return response_json.get("result", {})
  except requests.exceptions.RequestException as e:
    logging.error(
        "MCP Tool '%s' failed with RequestException: %s",
        tool_name,
        e,
        exc_info=True,
    )
    return {"error": str(e)}
  except Exception as e:
    logging.error(
        "Unexpected error in execute_mcp_tool for %s: %s",
        tool_name,
        e,
        exc_info=True,
    )
    return {"error": f"Unexpected error: {str(e)}"}


def list_mcp_tools() -> list[dict[str, Any]]:
  """Lists all available tools from the MCP server.

  Returns:
    A list of dictionaries, where each dictionary describes an available tool,
    or an empty list if an error occurs.
  """
  payload = {
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": f"test-list-{os.urandom(4).hex()}",
  }
  headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
  }
  try:
    response = requests.post(
        MCP_SERVER_URL, json=payload, headers=headers, timeout=10
    )
    response.raise_for_status()
    response_json = _parse_sse_response(
        response.text
    )  # Also use _parse_sse_response

    if response_json is None:
      return []

    if "error" in response_json:
      logging.error(
          "MCP tools/list failed with JSON-RPC error: %s",
          json.dumps(response_json['error'])
      )
      return []

    return response_json.get("result", {}).get("tools", [])
  except requests.exceptions.RequestException as e:
    logging.error(
        "MCP tools/list failed with RequestException: %s", e, exc_info=True
    )
    return []
  except Exception as e:
    logging.error("Unexpected error in list_mcp_tools: %s", e, exc_info=True)
    return []


def get_mcp_prompt(prompt_name: str, arguments: dict[str, str] = None) -> Optional[str]:
  """Retrieves a specific prompt from the MCP server.

  Args:
    prompt_name: The name of the prompt to retrieve.
    arguments: Optional arguments for the prompt.

  Returns:
    The prompt text, or None if retrieval fails.
  """
  payload = {
      "jsonrpc": "2.0",
      "method": "prompts/get",
      "id": f"test-prompt-{os.urandom(4).hex()}",
      "params": {"name": prompt_name, "arguments": arguments or {}},
  }
  headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
  }
  try:
    response = requests.post(
        MCP_SERVER_URL, json=payload, headers=headers, timeout=10
    )
    response.raise_for_status()
    response_json = _parse_sse_response(response.text)

    if response_json and "result" in response_json:
      messages = response_json["result"].get("messages", [])
      if messages:
        # Concatenate message contents if multiple
        return "\n\n".join([m.get("content", {}).get("text", "") for m in messages])
    return None
  except Exception as e:
    logging.error("Error retrieving prompt %s: %s", prompt_name, e)
    return None
