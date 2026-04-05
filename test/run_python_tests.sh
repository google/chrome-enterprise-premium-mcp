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

# Exit on any error
set -e

# Prevent Python from writing .pyc and __pycache__ directories
export PYTHONDONTWRITEBYTECODE=1

# Change to the root directory of the project
cd "$(dirname "$0")/.."

# If not in a virtual environment, set up a local one
if [ -z "$VIRTUAL_ENV" ]; then
  VENV_DIR="$HOME/.cache/cep-agent-venv"

  if [ ! -d "$VENV_DIR" ]; then
    # TODO: User should prompted before creating a new venv. But retaining a non-interactive option would be good for automated testing.
    echo "--- No VIRTUAL_ENV detected. Setting up new venv at $VENV_DIR ---"
    mkdir -p "$HOME/.cache"
    python3 -m venv "$VENV_DIR"
  fi

  source "$VENV_DIR/bin/activate"

  pip install -q -r requirements.txt
fi

echo "--- Running Python tests ---"

# Temporarily disable exit-on-error to capture the test exit code
set +e
if [ "$#" -gt 0 ]; then
  python3 -m unittest "$@"
else
  python3 -m unittest discover test -p "*_test.py"
fi
EXIT_CODE=$?
set -e

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ PYTHON TESTS: PASSED"
else
  echo "❌ PYTHON TESTS: FAILED"
fi

# Exit with the exact status code from the tests
exit $EXIT_CODE
