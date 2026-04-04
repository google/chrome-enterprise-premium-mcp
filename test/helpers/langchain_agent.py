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

from inspect import Parameter
from inspect import Signature
import logging
import os
from typing import Any, Type

from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_core.messages import HumanMessage
from langchain_core.tools import BaseTool
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel
from pydantic import create_model
from pydantic import Field
from test.helpers.mcp_client import execute_mcp_tool
from test.helpers.mcp_client import list_mcp_tools

# Configure logging
logging.basicConfig(
    level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s'
)

# JSON Schema type constants
STRING_TYPE = 'string'
INTEGER_TYPE = 'integer'
NUMBER_TYPE = 'number'
BOOLEAN_TYPE = 'boolean'
OBJECT_TYPE = 'object'
ARRAY_TYPE = 'array'

TYPE_MAPPING = {
    STRING_TYPE: str,
    INTEGER_TYPE: int,
    NUMBER_TYPE: float,
    BOOLEAN_TYPE: bool,
    OBJECT_TYPE: dict,
}

AI_MODEL_NAME = 'gemini-2.5-flash'


def _get_pydantic_field_type(
    prop_schema: dict[str, Any], prop_name: str, model_name: str
) -> Any:
  """Determines the Pydantic field type from a JSON schema property."""
  prop_type = prop_schema.get('type')

  if prop_type == ARRAY_TYPE:
    items_schema = prop_schema.get('items')
    if items_schema:
      if items_schema.get('type') == OBJECT_TYPE and 'properties' in items_schema:
         sub_model = json_schema_to_pydantic_model(items_schema, f"{model_name}_{prop_name}_item")
         return list[sub_model]
      item_type = items_schema.get('type', STRING_TYPE)
      base_item_type = TYPE_MAPPING.get(item_type, Any)
      return list[base_item_type]
    else:
      logging.warning(
          "Array property '%s' in %s is missing 'items' schema. Defaulting to"
          ' list[str].',
          prop_name,
          model_name,
      )
      return list[str]
  elif prop_type == OBJECT_TYPE and 'properties' in prop_schema:
      return json_schema_to_pydantic_model(prop_schema, f"{model_name}_{prop_name}")
  else:
    return TYPE_MAPPING.get(prop_type, Any)


def json_schema_to_pydantic_model(
    schema: dict[str, Any], model_name: str
) -> Type[BaseModel]:
  """Converts a JSON Schema dictionary to a Pydantic BaseModel.

  Args:
    schema: The JSON Schema as a dictionary.
    model_name: The name for the created Pydantic model.

  Returns:
    A Pydantic BaseModel class.
  """
  fields = {}
  properties = schema.get('properties', {})
  required = schema.get('required', [])

  for prop_name, prop_schema in properties.items():
    description = prop_schema.get('description', '')
    default_value = prop_schema.get('default', ...)

    field_type = _get_pydantic_field_type(prop_schema, prop_name, model_name)

    # Handle Optional fields
    if prop_name not in required:
      if default_value is ...:
        default_value = None
      field_type = field_type | None  # Union type for Optional

    fields[prop_name] = (
        field_type,
        Field(default_value, description=description),
    )

  return create_model(model_name, **fields)


def create_langchain_tool(mcp_tool_spec: dict[str, Any]) -> BaseTool:
  """Creates a LangChain tool dynamically from an MCP tool specification.

  Args:
    mcp_tool_spec: A dictionary containing the tool's name, description, and
      inputSchema.

  Returns:
    A LangChain BaseTool instance.
  """
  tool_name = mcp_tool_spec['name']
  description = mcp_tool_spec['description']
  input_schema = mcp_tool_spec['inputSchema']

  ArgsModel = json_schema_to_pydantic_model(input_schema, f'{tool_name}Args')

  def _execute(**kwargs):
    def serialize_value(v):
        if hasattr(v, 'model_dump'):
            return serialize_value(v.model_dump())
        elif isinstance(v, dict):
             # Strip out keys with None values so Zod sees them as undefined
             return {key: serialize_value(val) for key, val in v.items() if val is not None}
        elif isinstance(v, list):
             return [serialize_value(item) for item in v]
        else:
             return v

    serialized_kwargs = serialize_value(kwargs)
    return execute_mcp_tool(tool_name, serialized_kwargs)

  # Create parameters for the dynamic function signature
  params = []
  for name, field in ArgsModel.model_fields.items():
    annotation = field.annotation
    default = field.default
    if default is ...:  # Required
      params.append(
          Parameter(
              name, Parameter.POSITIONAL_OR_KEYWORD, annotation=annotation
          )
      )
    else:  # Optional
      params.append(
          Parameter(
              name,
              Parameter.POSITIONAL_OR_KEYWORD,
              annotation=annotation,
              default=default,
          )
      )

  sig = Signature(params)

  # Create the dynamic function
  def dynamic_func(**kwargs):
    return _execute(**kwargs)

  # Set name and docstring for the tool decorator to pick up
  dynamic_func.__name__ = tool_name
  dynamic_func.__doc__ = description
  dynamic_func.__signature__ = sig
  dynamic_func.__annotations__ = {p.name: p.annotation for p in params}

  # Apply the tool decorator
  return tool(args_schema=ArgsModel)(dynamic_func)


def _create_tools_from_specs(
    mcp_tools_specs: list[dict[str, Any]],
) -> list[BaseTool]:
  """Creates LangChain tools from a list of MCP tool specifications."""
  tools = []
  for spec in mcp_tools_specs:
    try:
      if spec.get('name'):
        langchain_tool = create_langchain_tool(spec)
        tools.append(langchain_tool)
        logging.info('Successfully created tool: %s', spec['name'])
      else:
        logging.warning('Skipping tool spec without a name: %s', spec)
    except Exception as e:
      logging.error(
          'Error creating tool %s: %s',
          spec.get('name', 'Unknown'),
          e,
          exc_info=True,
      )
  return tools


# --------------- Agent Setup ---------------
def get_agent():
  """Creates and returns a configured LangChain agent.

  Returns:
    A configured LangChain agent instance.

  Raises:
    ValueError: If the GEMINI_API_KEY environment variable is not set.
  """
  if not os.environ.get('GEMINI_API_KEY'):
    raise ValueError('GEMINI_API_KEY not set')

  logging.info('Fetching tools from MCP server...')
  mcp_tools_specs = list_mcp_tools()
  logging.info('Found %d tools.', len(mcp_tools_specs))

  tools = _create_tools_from_specs(mcp_tools_specs)

  if not tools:
    logging.warning(
        'No tools were dynamically created. Agent will have no tools.'
    )

  llm = ChatGoogleGenerativeAI(model=AI_MODEL_NAME)

  agent = create_agent(
      model=llm,
      tools=tools,
      system_prompt=(
          'You are a helpful assistant for Chrome Enterprise Premium. Use the'
          ' provided tools to answer user questions.'
      ),
  )
  return agent


def query_agent_oneshot(prompt_text: str) -> str:
  """Creates a new agent, invokes it with the prompt, and returns the output.

  Assumes MCP server is running.

  Args:
    prompt_text: The user's prompt to send to the agent.

  Returns:
    The agent's text response.

  Raises:
    RuntimeError: If any error occurs during agent creation or invocation.
  """
  try:
    agent = get_agent()
    messages = [HumanMessage(content=prompt_text)]
    result = agent.invoke({'messages': messages})
    # The output structure is in the 'messages' key, typically the last message
    if result and 'messages' in result and len(result['messages']) > 0:
      last_message = result['messages'][-1]
      if isinstance(last_message, AIMessage):
        return last_message.content
      else:
        # Fallback for the original structure you mentioned
        if isinstance(last_message, dict) and 'content' in last_message:
          return last_message['content']
        return f'Unexpected last message type: {type(last_message)}'
    return 'No output from agent'
  except Exception as e:
    raise RuntimeError(f'Error querying agent: {e}') from e
