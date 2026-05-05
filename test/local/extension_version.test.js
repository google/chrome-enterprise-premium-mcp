/* eslint-disable */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('gemini-extension.json package version matches package.json version', () => {
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const extensionJsonPath = path.resolve(__dirname, '../../gemini-extension.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'));

  const currentVersion = packageJson.version;
  
  const args = extensionJson.mcpServers['chrome-enterprise-premium'].args;
  assert.ok(Array.isArray(args), 'args must be an array');

  const packageArg = args.find(arg => arg.startsWith('@google/chrome-enterprise-premium-mcp@'));
  assert.ok(packageArg, 'Could not find @google/chrome-enterprise-premium-mcp dependency in args');

  const rangeString = packageArg.split('@').pop();
  assert.ok(rangeString, 'Could not extract version range from argument');

  assert.ok(rangeString.startsWith('^'), 'Version range must start with ^ for semantic versioning');
  const rangeVersion = rangeString.slice(1);
  const [rMajor, rMinor, rPatch] = rangeVersion.split('.').map(Number);
  const [cMajor, cMinor, cPatch] = currentVersion.split('.').map(Number);

  assert.strictEqual(cMajor, rMajor, `Major version mismatch: current ${cMajor} must match range ${rMajor}`);

  if (cMinor === rMinor) {
    assert.ok(cPatch >= rPatch, `Patch version is older than range: current ${cPatch} must be >= ${rPatch}`);
  } else {
    assert.ok(cMinor > rMinor, `Minor version is older than range: current ${cMinor} must be > ${rMinor}`);
  }
});
