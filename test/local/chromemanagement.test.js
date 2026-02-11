
import assert from 'node:assert/strict';
import { describe, it, mock, beforeEach } from 'node:test';
import esmock from 'esmock';

describe('Chrome Management API', () => {
  let server;
  let mockCountBrowserVersions;
  let mockListCustomerProfiles;
  let registerTools;

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    };
  });

  describe('count_browser_versions Tool', () => {
    it('should call countBrowserVersions and return formatted result', async () => {
      const mockCountBrowserVersions = mock.fn(async () => [
        { version: '120.0.6099.71', count: 10, releaseChannel: 'Stable' },
        { version: '119.0.0.0', count: 5, releaseChannel: 'Beta' },
      ]);

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/chromemanagement.js': {
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
          '../../lib/api/chromemanagement.js': {
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

  describe('list_customer_profiles Tool', () => {
    it('should call listCustomerProfiles and return formatted result', async () => {
      const mockListCustomerProfiles = mock.fn(async () => [
        { name: 'profile1', value: 'value1' },
        { name: 'profile2', value: 'value2' },
      ]);

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/chromemanagement.js': {
            listCustomerProfiles: mockListCustomerProfiles,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_customer_profiles'
      ).arguments[2];

      const sendNotificationMock = mock.fn();
      const result = await handler(
        { customerId: 'C0123' },
        { sendNotification: sendNotificationMock }
      );

      assert.strictEqual(mockListCustomerProfiles.mock.callCount(), 1);
      const expectedText =
        'Browser versions for customer C0123:\n' +
        '[{"name":"profile1","value":"value1"},{"name":"profile2","value":"value2"}]';
      assert.deepStrictEqual(result.content[0].text, expectedText);
    });

    it('should return an error message if API call fails', async () => {
      const mockListCustomerProfiles = mock.fn(async () => {
        throw new Error('API Error');
      });

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/chromemanagement.js': {
            listCustomerProfiles: mockListCustomerProfiles,
          },
        }
      );
      registerTools(server, { gcpCredentialsAvailable: true });

      const handler = server.registerTool.mock.calls.find(
        (call) => call.arguments[0] === 'list_customer_profiles'
      ).arguments[2];

      const sendNotificationMock = mock.fn();
      const result = await handler(
        { customerId: 'C0123' },
        { sendNotification: sendNotificationMock }
      );
      assert.deepStrictEqual(
        result.content[0].text,
        'Error listing customer profiles: API Error'
      );
    });
  });
});
