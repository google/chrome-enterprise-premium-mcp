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
import os
import unittest
from unittest import mock

from test.helpers.nl_check import assert_nl_condition
from test.helpers.nl_check import BooleanResult
from test.helpers.nl_check import call_gemini_flash
from test.helpers.nl_check import check_nl_condition


class TestNLChecker(unittest.TestCase):

  @mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test_key"}, clear=False)
  @mock.patch("google.genai.Client")
  def test_call_gemini_flash_success(self, MockClient):
    """Test call_gemini_flash on successful API call."""
    mock_generate_content = MockClient.return_value.models.generate_content
    mock_generate_content.return_value.text = "Mocked Gemini Response"

    prompt = "What is today's date?"
    result = call_gemini_flash(prompt)
    self.assertEqual(result, "Mocked Gemini Response")
    mock_generate_content.assert_called_once()

  @mock.patch.dict(os.environ, {}, clear=False)
  @mock.patch("google.genai.Client")
  def test_call_gemini_flash_no_api_key(self, MockClient):
    """Test call_gemini_flash when API key is not set."""
    if "GEMINI_API_KEY" in os.environ:
      del os.environ["GEMINI_API_KEY"]

    with self.assertRaises(RuntimeError) as context:
      call_gemini_flash("Test Prompt")
    self.assertIn(
        "GEMINI_API_KEY environment variable not set", str(context.exception)
    )
    MockClient.return_value.models.generate_content.assert_not_called()

  @mock.patch("test.helpers.nl_check.call_gemini_flash")
  def test_check_nl_condition_true(self, mock_call_gemini):
    """Test check_nl_condition when the condition is true."""
    mock_call_gemini.return_value = json.dumps(BooleanResult.TRUE.value)
    text = "The apple is red."
    condition = "The text says the apple is red"
    result = check_nl_condition(text, condition)
    self.assertTrue(result)
    mock_call_gemini.assert_called_once()
    _, mock_kwargs = mock_call_gemini.call_args
    self.assertEqual(mock_kwargs["response_schema"], BooleanResult)

  @mock.patch("test.helpers.nl_check.call_gemini_flash")
  def test_check_nl_condition_false(self, mock_call_gemini):
    """Test check_nl_condition when the condition is false."""
    mock_call_gemini.return_value = json.dumps(BooleanResult.FALSE.value)
    text = "The apple is red."
    condition = "The text says the apple is green"
    result = check_nl_condition(text, condition)
    self.assertFalse(result)
    mock_call_gemini.assert_called_once()

  @mock.patch("test.helpers.nl_check.call_gemini_flash")
  def test_check_nl_condition_invalid_json(self, mock_call_gemini):
    """Test check_nl_condition when the model returns invalid JSON."""
    mock_call_gemini.return_value = "Not JSON"
    text = "The apple is red."
    condition = "Is the apple red?"
    with self.assertRaises(ValueError) as context:
      check_nl_condition(text, condition)
    self.assertIn("Failed to decode JSON", str(context.exception))
    mock_call_gemini.assert_called_once()

  @mock.patch("test.helpers.nl_check.call_gemini_flash")
  def test_check_nl_condition_unexpected_value(self, mock_call_gemini):
    """Test check_nl_condition when the model returns an unexpected value within JSON."""
    mock_call_gemini.return_value = json.dumps("Maybe")
    text = "The apple is red."
    condition = "Is the apple red?"
    with self.assertRaises(ValueError) as context:
      check_nl_condition(text, condition)
    self.assertIn("Unexpected response value", str(context.exception))
    mock_call_gemini.assert_called_once()

  @mock.patch("test.helpers.nl_check.check_nl_condition")
  def test_assert_nl_condition_passes(self, mock_check):
    """Test assert_nl_condition when the condition is true."""
    mock_check.return_value = True
    text = "The event is scheduled for 2026-02-11."
    condition = "The event date is in the future."
    try:
      assert_nl_condition(text, condition)
    except Exception as e:
      self.fail(f"assert_nl_condition raised an exception unexpectedly: {e}")
    mock_check.assert_called_once_with(text, condition)

  @mock.patch("test.helpers.nl_check.check_nl_condition")
  def test_assert_nl_condition_fails_on_false(self, mock_check):
    """Test assert_nl_condition when the condition is false."""
    mock_check.return_value = False
    text = "The quick brown fox jumps over the lazy dog."
    condition = "The text contains the number 7"
    with self.assertRaises(AssertionError):
      assert_nl_condition(text, condition)
    mock_check.assert_called_once_with(text, condition)

  @mock.patch("test.helpers.nl_check.check_nl_condition")
  def test_assert_nl_condition_raises_runtime_on_check_error(self, mock_check):
    """Test assert_nl_condition when check_nl_condition raises an error."""
    mock_check.side_effect = ValueError("Simulated check_nl_condition error")
    text = "Some text."
    condition = "Some condition"
    with self.assertRaises(RuntimeError) as context:
      assert_nl_condition(text, condition)
    self.assertIn("Could not determine truth value", str(context.exception))
    self.assertIn("Simulated check_nl_condition error", str(context.exception))
    mock_check.assert_called_once_with(text, condition)


if __name__ == "__main__":
  unittest.main()
