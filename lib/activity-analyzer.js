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

// TO DO: Needs to change based on URL risk level
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
function analyzeFileUploadEvents(activities) {
  const riskyActivities = [];
  for (const activity of activities) {
    for (const event of activity.events) {
      if (event.name === 'CONTENT_TRANSFER') {
        const url = event.parameters.find(p => p.name === 'URL')?.value;
        const trigger = event.parameters.find(p => p.name === 'trigger')?.value;
        if (url && trigger === 'UPLOAD' && KNOWN_PERSONAL_STORAGE_SITES.some(site => url.includes(site))) {
          riskyActivities.push({
            user: activity.actor.email,
            activity: 'Uploaded a file to a personal storage site',
            details: `File: ${event.parameters.find(p => p.name === 'FILENAME')?.value}, URL: ${url}`
          });
        }
      }
    }
  }
  return riskyActivities;
}
function analyzeFileDownloadEvents(activities) {
    const riskyActivities = [];
    for (const activity of activities) {
      for (const event of activity.events) {
        if (event.name === 'CONTENT_TRANSFER') {
          const filename = event.parameters.find(p => p.name === 'FILENAME')?.value;
          const trigger = event.parameters.find(p => p.name === 'trigger')?.value;
          if (filename && trigger?.startsWith('DOWNLOAD') && RISKY_FILE_EXTENSIONS.some(ext => filename.endsWith(ext))) {
            riskyActivities.push({
              user: activity.actor.email,
              activity: 'Downloaded a potentially risky file',
              details: `File: ${filename}`
            });
          }
        }
      }
    }
    return riskyActivities;
  }
function analyzeUrlVisitedEvents(activities) {
  const riskyActivities = [];
  for (const activity of activities) {
    for (const event of activity.events) {
      if (event.name === 'URL_VISITED') {
        const url = event.parameters.find(p => p.name === 'URL')?.value;
        if (url && KNOWN_SOCIAL_MEDIA_SITES.some(site => url.includes(site))) {
          riskyActivities.push({
            user: activity.actor.email,
            activity: 'Visited a social media site',
            details: `URL: ${url}`
          });
        }
      }
    }
  }
  return riskyActivities;
}
export function analyzeChromeActivity(activities) {
  const riskyActivities = [
    ...analyzeFileUploadEvents(activities),
    ...analyzeFileDownloadEvents(activities),
    ...analyzeUrlVisitedEvents(activities),
  ];
  return riskyActivities;
}
