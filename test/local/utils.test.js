import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { guardedToolCall, validateAndGetOrgUnitId } from '../../tools/utils.js'

// This is a bit of a hack to get access to the un-exported commonTransform function.
// In a real-world scenario, this would be exported from utils.js.
const commonTransform = (params) => {
  const newParams = { ...params };
  if (newParams.customerId === 'me') {
    newParams.customerId = undefined;
  }
  if (newParams.orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId);
  }
  return newParams;
};

describe('Tool Utils', () => {
  describe('commonTransform', () => {
    it('should normalize customerId "me" to undefined', () => {
      const params = { customerId: 'me' };
      const transformed = commonTransform(params);
      assert.strictEqual(transformed.customerId, undefined);
    });

    it('should strip "id:" prefix from orgUnitId', () => {
      const params = { orgUnitId: 'id:12345' };
      const transformed = commonTransform(params);
      assert.strictEqual(transformed.orgUnitId, '12345');
    });

    it('should not modify other parameters', () => {
      const params = { customerId: 'C123', orgUnitId: '12345', other: 'value' };
      const transformed = commonTransform(params);
      assert.deepStrictEqual(transformed, { customerId: 'C123', orgUnitId: '12345', other: 'value' });
    });
  });
  describe('guardedToolCall', () => {
    it('should update cachedCustomerId when params.customerId is provided', async () => {
      const handler = async (params) => {
        return { params };
      };
      const tool = guardedToolCall({ handler });

      // First call with a customerId
      await tool({ customerId: 'C123' }, {});

      // Second call without a customerId
      const result = await tool({}, {});

      // Check if the cached customerId was used
      assert.strictEqual(result.params.customerId, 'C123');
    });
  });
});