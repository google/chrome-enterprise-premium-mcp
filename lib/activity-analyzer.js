/**
 * @fileoverview Chrome Activity Log Analyzer.
 *
 * Provides functions to analyze user activity logs for risky behaviors,
 * such as uploading files to personal storage, downloading risky file types,
 * or visiting social media sites.
 */

// TODO: Needs to change based on URL risk level
const KNOWN_PERSONAL_STORAGE_SITES = [
  'dropbox.com',
  'mega.nz',
  'personal-storage.com',
  'another-personal-storage.com',
];

const KNOWN_SOCIAL_MEDIA_SITES = [
  'facebook.com',
  'twitter.com',
  'reddit.com',
  'instagram.com',
];

const RISKY_FILE_EXTENSIONS = [
  '.exe',
  '.dmg',
  '.bat',
  '.sh',
  '.msi',
  '.jar',
];

/**
 * Analyzes file upload events for uploads to known personal storage sites.
 *
 * @param {Array<object>} activities - The list of activity logs.
 * @returns {Array<object>} A list of risky activities identified.
 */
function analyzeFileUploadEvents(activities) {
  const riskyActivities = [];

  for (const activity of activities) {
    for (const event of activity.events) {
      if (event.name === 'CONTENT_TRANSFER') {
        const url = event.parameters.find((p) => p.name === 'URL')?.value;
        const trigger = event.parameters.find((p) => p.name === 'trigger')?.value;

        if (
          url &&
          trigger === 'UPLOAD' &&
          KNOWN_PERSONAL_STORAGE_SITES.some((site) => url.includes(site))
        ) {
          riskyActivities.push({
            user: activity.actor.email,
            activity: 'Uploaded a file to a personal storage site',
            details: `File: ${
              event.parameters.find((p) => p.name === 'FILENAME')?.value
            }, URL: ${url}`,
          });
        }
      }
    }
  }

  return riskyActivities;
}

/**
 * Analyzes file download events for downloads of risky file extensions.
 *
 * @param {Array<object>} activities - The list of activity logs.
 * @returns {Array<object>} A list of risky activities identified.
 */
function analyzeFileDownloadEvents(activities) {
  const riskyActivities = [];

  for (const activity of activities) {
    for (const event of activity.events) {
      if (event.name === 'CONTENT_TRANSFER') {
        const filename = event.parameters.find((p) => p.name === 'FILENAME')?.value;
        const trigger = event.parameters.find((p) => p.name === 'trigger')?.value;

        if (
          filename &&
          trigger?.startsWith('DOWNLOAD') &&
          RISKY_FILE_EXTENSIONS.some((ext) => filename.endsWith(ext))
        ) {
          riskyActivities.push({
            user: activity.actor.email,
            activity: 'Downloaded a potentially risky file',
            details: `File: ${filename}`,
          });
        }
      }
    }
  }

  return riskyActivities;
}

/**
 * Analyzes URL visited events for visits to social media sites.
 *
 * @param {Array<object>} activities - The list of activity logs.
 * @returns {Array<object>} A list of risky activities identified.
 */
function analyzeUrlVisitedEvents(activities) {
  const riskyActivities = [];

  for (const activity of activities) {
    for (const event of activity.events) {
      if (event.name === 'URL_VISITED') {
        const url = event.parameters.find((p) => p.name === 'URL')?.value;

        if (
          url &&
          KNOWN_SOCIAL_MEDIA_SITES.some((site) => url.includes(site))
        ) {
          riskyActivities.push({
            user: activity.actor.email,
            activity: 'Visited a social media site',
            details: `URL: ${url}`,
          });
        }
      }
    }
  }

  return riskyActivities;
}

/**
 * Analyzes Chrome activity logs for various risky behaviors.
 *
 * Aggregates results from file upload, download, and URL visit analysis.
 *
 * @param {Array<object>} activities - The list of activity logs to analyze.
 * @returns {Array<object>} A consolidated list of all identified risky activities.
 */
export function analyzeChromeActivity(activities) {
  const riskyActivities = [
    ...analyzeFileUploadEvents(activities),
    ...analyzeFileDownloadEvents(activities),
    ...analyzeUrlVisitedEvents(activities),
  ];
  
  return riskyActivities;
}
