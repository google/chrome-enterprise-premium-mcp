
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
