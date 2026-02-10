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

import assert from 'node:assert/strict';
import { describe, it, mock, beforeEach } from 'node:test';
import esmock from 'esmock';

// Tests for CEP tool registration and individual tool handler logic.
describe('CEP Tool Registration and Units', () => {
  let server;

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    };
  });

  // Test if all tools are registered with the server.
  it('should register all expected tools', async () => {
    const { registerTools } = await esmock('../../tools/tools.js');
    registerTools(server);

    const registeredToolNames = server.registerTool.mock.calls.map(
      (call) => call.arguments[0]
    );
    const expectedToolNames = [
      'count_browser_versions',
      'list_customer_profiles',
      'list_dlp_rules',
      'create_dlp_rule',
      'get_chrome_activity_log',
      'analyze_chrome_logs_for_risky_activity',
      'delete_dlp_rule',
      'create_url_list',
      'get_connector_policy',
      'get_customer_id',
      'list_org_units'
    ].sort();
    assert.deepStrictEqual(
      registeredToolNames.sort(),
      expectedToolNames,
      'The list of registered tool names does not match the expected list.'
    );
  });

  // Unit tests for the 'count_browser_versions' tool.
  describe('count_browser_versions Tool', () => {
    // Test successful API call and response formatting.
    it('should call countBrowserVersions and return formatted result', async () => {
      const mockCountBrowserVersions = mock.fn(async () => [
        { version: '120.0.6099.71', count: 10, releaseChannel: 'Stable' },
        { version: '119.0.0.0', count: 5, releaseChannel: 'Beta' },
      ]);

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/chromemanagement.js': {
            countBrowserVersions: mockCountBrowserVersions,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'count_browser_versions'
      ).arguments[2];

      const sendNotificationMock = mock.fn();
      const result = await handler(
        { project: 'test-project', customerId: 'C0123' },
        { sendNotification: sendNotificationMock } // Added mock context
      );

      assert.strictEqual(mockCountBrowserVersions.mock.callCount(), 1);
      const expectedText =
        'Browser versions for customer C0123:\n' +
        '- 120.0.6099.71 (10 devices) - Stable\n' +
        '- 119.0.0.0 (5 devices) - Beta';
      assert.deepStrictEqual(result.content[0].text, expectedText);
    });

    // Test error handling when the API call fails.
    it('should return an error message if API call fails', async () => {
      const mockCountBrowserVersions = mock.fn(async () => {
        throw new Error('API Error');
      });

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/cloud-api/chromemanagement.js': {
            countBrowserVersions: mockCountBrowserVersions,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'count_browser_versions'
      ).arguments[2];

      const sendNotificationMock = mock.fn();
      const result = await handler(
        { project: 'test-project', customerId: 'C0123' },
        { sendNotification: sendNotificationMock } // Added mock context
      );
      assert.deepStrictEqual(
        result.content[0].text,
        'Error counting browser versions: API Error'
      );
    });
  });
});