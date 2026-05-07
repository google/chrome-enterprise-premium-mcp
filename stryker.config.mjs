import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

/**
 * CONFIGURATION: STABLE AUTO-AUDIT
 * 
 * We pick a fixed percentage of the codebase to mutation test. 
 * The selection is deterministic (based on filename), so the same files 
 * are tested every time. This allows the team to focus on improving 
 * coverage for a stable set of files without manual list maintenance.
 */
const AUDIT_SAMPLE_PERCENTAGE = 10; 

const IGNORED_PATHS = [
  'lib/util/chrome_dlp_constants.js', 
  'lib/api/interfaces/',             
  'lib/knowledge/',                  
];

function getStableAuditFiles(directory) {
  const allFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        if (!IGNORED_PATHS.some(ignored => fullPath.includes(ignored))) {
          allFiles.push(fullPath);
        }
      }
    }
  };
  walk(directory);

  return allFiles.filter(file => {
    // Stable hash (no time-based salt)
    const hash = crypto.createHash('md5').update(file).digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    return bucket < AUDIT_SAMPLE_PERCENTAGE;
  });
}

/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  // Automatically select a stable subset of the library based on AUDIT_SAMPLE_PERCENTAGE
  mutate: getStableAuditFiles('lib'),

  testRunner: 'command',
  commandRunner: {
    command: 'npm run test:unit',
  },

  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 30000,
  ignoreStatic: true,
  incremental: true,
  thresholds: { high: 80, low: 60, break: null }
};
