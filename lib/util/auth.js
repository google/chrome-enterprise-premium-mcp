/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const instructionsPath = join(__dirname, '../../../instructions/adc_setup.txt');

function getAuthErrorMessage(error) {
  try {
    const template = readFileSync(instructionsPath, 'utf-8');
    return template.replace('{ERROR_MESSAGE}', error.message);
  } catch (readError) {
     return `ERROR: Google Cloud Application Default Credentials are not set up.
An unexpected error occurred during credential verification.

For more details or alternative setup methods, consider:
1. If running locally, run: gcloud auth application-default login.
2. Ensuring the \`GOOGLE_APPLICATION_CREDENTIALS\` environment variable points to a valid service account key file.
3. If on a Google Cloud environment (e.g., GCE, Cloud Run), verify the associated service account has necessary permissions.

Original error message from Google Auth Library: ${error.message}`;
  }
}

async function getAuthClient(scopes, authToken) {
  if (authToken) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: authToken });
    return auth;
  }

  const auth = new GoogleAuth({ scopes });
  try {
    return await auth.getClient();
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

async function ensureADCCredentials() {
  try {
    const auth = new GoogleAuth();
    const client = await auth.getClient();
    await client.getAccessToken();
    return true;
  } catch (error) {
    console.error(getAuthErrorMessage(error));
    return false;
  }
}

export { getAuthClient, ensureADCCredentials };