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

from enum import Enum
import json
import os

import google.genai as genai

AI_MODEL_NAME = "gemini-2.0-flash"

# Enum to define the structured output schema for boolean result
class BooleanResult(Enum):
  TRUE = "True"
  FALSE = "False"


def call_gemini_flash(prompt_text, response_schema=None):
  """Calls the gemini-2.5-flash model and returns the generated text as a string.

  Optionally uses a response schema for structured output.
  """
  api_key = os.environ.get("GEMINI_API_KEY")
  if not api_key:
    raise RuntimeError("GEMINI_API_KEY environment variable not set.")

  client = genai.Client(api_key=api_key)

  config = {}
  if response_schema:
    config = {
        "response_mime_type": "application/json",
        "response_schema": response_schema,
    }

  response = client.models.generate_content(
      model=AI_MODEL_NAME,
      contents=[prompt_text],
      config=config if config else None,
  )
  return response.text if response and response.text else None


def check_nl_condition(text, condition):
  """Checks if a natural language condition is true for the given text using Gemini

  with structured output. Returns a Python boolean.

  Args:
      text: The text to evaluate.
      condition: The natural language condition to check.

  Returns:
      True if the condition is met, False otherwise.

  Raises:
      ValueError: If the model response is empty, not valid JSON,
                  or not one of the expected 'True' or 'False' values.
      Exception: For any other errors during the Gemini API call.
  """
  prompt = f"""
Evaluate if the following condition is true for the given text.
Condition: "{condition}"
Text: "{text}"

Your response MUST be one of the following enum values: "True" or "False".
"""

  result_str = call_gemini_flash(prompt, response_schema=BooleanResult)
  if not result_str:
    raise ValueError("Failed to get a valid response from model.")

  try:
    data = json.loads(result_str)
    parsed_str = str(data).strip().upper()
  except json.JSONDecodeError:
    raise ValueError(f"Failed to decode JSON from model response: {result_str}")

  if parsed_str == BooleanResult.TRUE.value.upper():
    return True
  elif parsed_str == BooleanResult.FALSE.value.upper():
    return False
  else:
    raise ValueError(
        f"Unexpected response value after JSON parsing: {parsed_str}"
    )


def assert_nl_condition(text, condition):
  """Asserts that a natural language condition is true for the given text.

  Raises an AssertionError if the condition is false.

  Args:
      text: The text to evaluate.
      condition: The natural language condition to check.

  Raises:
      AssertionError: If the condition is evaluated as False.
      RuntimeError: If check_nl_condition raises an exception, indicating an
      issue
                    determining the truth value.
  """
  result = None
  try:
    result = check_nl_condition(text, condition)
  except ValueError as e:
    raise RuntimeError(
        f"Could not determine truth value for condition '{condition}' on text:"
        f" '{text}'. Details: {e}"
    ) from e
  except Exception as e:
    raise RuntimeError(
        "An unexpected error occurred during natural language check for"
        f" condition '{condition}' on text: '{text}'. Details: {e}"
    ) from e

  if not result:
    raise AssertionError(
        f"Assertion failed: Condition '{condition}' is false for text: '{text}'"
    )
  # If result is True, the assertion passes silently
