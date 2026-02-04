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

import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

async function listChromeActivities(options) {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
  });
  const client = await auth.getClient();
  const service = google.admin({ version: 'reports_v1', auth: client });
  const response = await service.activities.list({
    userKey: options.userKey || 'all',
    applicationName: 'chrome',
    eventName: options.eventName,
    startTime: options.startTime,
    endTime: options.endTime,
    maxResults: options.maxResults,
  });
  return response.data.items;
}

export {
  listChromeActivities,
};
