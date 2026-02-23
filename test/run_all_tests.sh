#!/bin/bash
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

# Change to the root directory of the project
cd "$(dirname "$0")/.."

# Function to run a test script and return its status
run_test_suite() {
  local script_path=$1
  local suite_name=$2

  if [ -f "$script_path" ]; then
    bash "$script_path"
    return $?
  else
    echo "❌ Error: Test script not found: $script_path"
    return 1
  fi
}

# Run JS tests
run_test_suite "./test/run_js_tests.sh" "JS"
JS_STATUS=$?

echo "----------------------------------------"

# Run Python tests
run_test_suite "./test/run_python_tests.sh" "Python"
PYTHON_STATUS=$?

echo "----------------------------------------"

# Final verdict
if [ $JS_STATUS -eq 0 ] && [ $PYTHON_STATUS -eq 0 ]; then
  echo "✅ ALL TESTS: PASSED"
  exit 0
else
  echo "❌ ALL TESTS: FAILED"

  # Print which ones failed
  [ $JS_STATUS -ne 0 ] && echo "   - JS tests failed"
  [ $PYTHON_STATUS -ne 0 ] && echo "   - Python tests failed"

  exit 1
fi
