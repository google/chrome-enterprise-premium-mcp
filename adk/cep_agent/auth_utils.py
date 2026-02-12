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

def get_auth_instructions(error_message="Unknown error"):
    """
    Reads the authentication setup instructions from a shared text file.
    
    Args:
        error_message (str): The specific error message to inject into the template.
        
    Returns:
        str: The formatted instructions string.
    """
    # Get the directory of the current file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct the path to the instructions file
    # Path: adk/cep_agent/ -> ../../instructions/adc_setup.txt
    instructions_path = os.path.join(current_dir, '../../instructions/adc_setup.txt')
    
    try:
        with open(instructions_path, 'r') as f:
            template = f.read()
            return template.replace('{ERROR_MESSAGE}', str(error_message))
    except FileNotFoundError:
        # Fallback message if file is missing
        return (
            "ERROR: Google Cloud Application Default Credentials are not set up.\n"
            "An unexpected error occurred during credential verification.\n\n"
            "For more details or alternative setup methods, consider:\n"
            "1. If running locally, run: gcloud auth application-default login.\n"
            "2. Ensuring the `GOOGLE_APPLICATION_CREDENTIALS` environment variable points to a valid service account key file.\n"
            f"\nOriginal error message: {error_message}"
        )
