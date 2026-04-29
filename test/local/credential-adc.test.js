import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { adcCredential } from '../../lib/util/credential/adc.js'

describe('adcCredential', () => {
  describe('probe', () => {
    it('When ADC is not configured, then it returns ok:false with source:adc', async () => {
      // Force GoogleAuth to fail by pointing at a nonexistent credential file.
      const orig = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/path.json'
      try {
        const cred = adcCredential()
        const probe = await cred.probe()
        assert.equal(probe.ok, false)
        assert.equal(probe.source, 'adc')
      } finally {
        if (orig === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        else process.env.GOOGLE_APPLICATION_CREDENTIALS = orig
      }
    })
  })
})
