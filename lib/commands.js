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

function registerRunHealthCheckCommand(server) {
  server.registerPrompt(
    'run_health_check',
    {
      description: 'Runs a health check on the user\'s environment.',
      arguments: [],
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Chrome Enterprise security expert. Run a health check on the user's environment.

1. Get the user's customer ID.
2. Get the user's organizational units.
3. For each organizational unit, check the following:
    - Is Chrome Browser Cloud Management (CBCM) enrollment active?
    - Are browsers reporting to the admin console?
    - Is the Chrome browser version current?
    - Is an active CEP license assigned?
    - Are security connectors set to "Chrome Enterprise Premium"?
    - Is "Delay file upload" configured for enforcement?
    - Is Enhanced Safe Browsing enabled?
    - Are DLP rules enabled?
    - Is reporting enabled for DLP events?
4. Summarize your findings and report any issues by severity.`,
            },
          },
        ],
      };
    }
  );
}

function registerAssessDlpMaturityCommand(server) {
  server.registerPrompt(
    'assess_dlp_maturity',
    {
      description: 'Assesses the user\'s DLP maturity.',
      arguments: [],
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Chrome Enterprise security expert. Assess the user's DLP maturity.

1. Get the user's customer ID.
2. Get the user's organizational units.
3. Get the user's DLP rules.
4. Get the user's DLP events.
5. Analyze the DLP rule configuration and telemetry to determine the maturity stage.
6. Recommend next steps to improve the user's DLP maturity.`,
            },
          },
        ],
      };
    }
  );
}

function registerAnalyzeRuleNoiseCommand(server) {
  server.registerPrompt(
    'analyze_rule_noise',
    {
      description: 'Analyzes the user\'s DLP rule noise.',
      arguments: [],
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are a Chrome Enterprise security expert. Analyze the user's DLP rule noise.

1. Get the user's customer ID.
2. Get the user's DLP rules.
3. Get the user's DLP events.
4. Identify DLP rules with high false positive or override rates.
5. Recommend optimization actions to reduce rule noise.`,
            },
          },
        ],
      };
    }
  );
}

export function registerCommands(server) {
  registerRunHealthCheckCommand(server);
  registerAssessDlpMaturityCommand(server);
  registerAnalyzeRuleNoiseCommand(server);
}
