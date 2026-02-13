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

describe('Admin SDK API', () => {
  let server;

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    };
  });

  describe('get_customer_id Tool', () => {
    it('should call getCustomerId and return formatted result', async () => {
      const mockGetCustomerId = mock.fn(async () => ({
        id: 'C0123',
      }));

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/admin_sdk.js': {
            getCustomerId: mockGetCustomerId,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'get_customer_id'
      ).arguments[2];

      const result = await handler(
        {},
        {} // Added mock context
      );

      assert.strictEqual(mockGetCustomerId.mock.callCount(), 1);
      const expectedText = 'Customer ID: C0123';
      assert.deepStrictEqual(result.content[0].text, expectedText);
    });

    it('should return an error message if API call fails', async () => {
      const mockGetCustomerId = mock.fn(async () => {
        throw new Error('API Error');
      });

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/admin_sdk.js': {
            getCustomerId: mockGetCustomerId,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'get_customer_id'
      ).arguments[2];

      const result = await handler(
        {},
        {} // Added mock context
      );
      assert.deepStrictEqual(
        result.content[0].text,
        'Error: API Error'
      );
    });
  });

  describe('list_org_units Tool', () => {
    it('should call listOrgUnits and return formatted result', async () => {
      const mockListOrgUnits = mock.fn(async () => ({
        organizationUnits: [
          { name: 'ou1', orgUnitId: 'ou1' },
          { name: 'ou2', orgUnitId: 'ou2' },
        ],
      }));

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/admin_sdk.js': {
            listOrgUnits: mockListOrgUnits,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_org_units'
      ).arguments[2];

      const result = await handler(
        {},
        {} // Added mock context
      );

      assert.strictEqual(mockListOrgUnits.mock.callCount(), 1);
      const expectedText =
        'Organizational Units:\n' +
        '{\n' +
        '  "organizationUnits": [\n' +
        '    {\n' +
        '      "name": "ou1",\n' +
        '      "orgUnitId": "ou1"\n' +
        '    },\n' +
        '    {\n' +
        '      "name": "ou2",\n' +
        '      "orgUnitId": "ou2"\n' +
        '    }\n' +
        '  ]\n' +
        '}';
      assert.deepStrictEqual(result.content[0].text, expectedText);
    });

    it('should return an error message if API call fails', async () => {
      const mockListOrgUnits = mock.fn(async () => {
        throw new Error('API Error');
      });

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/admin_sdk.js': {
            listOrgUnits: mockListOrgUnits,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_org_units'
      ).arguments[2];

      const result = await handler(
        {},
        {} // Added mock context
      );
      assert.deepStrictEqual(
        result.content[0].text,
        'Error: API Error'
      );
    });
  });
});