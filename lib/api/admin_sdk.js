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

import { getAuthClient } from '../util/auth.js';
import { google } from 'googleapis';

// The customer ID for the current authenticated user.
// https://developers.google.com/workspace/admin/directory/v1/guides/manage-customers#retrieve_a_customer
const CURRENT_CUSTOMER = 'my_customer';

async function listChromeActivities(options, authToken) {
  const authClient = await getAuthClient(
    ['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
    authToken
  );
  const service = google.admin({ version: 'reports_v1', auth: authClient });
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

async function listOrgUnits(options, authToken) {
  const authClient = await getAuthClient(
    ['https://www.googleapis.com/auth/admin.directory.orgunit.readonly'],
    authToken
  );
  const service = google.admin({ version: 'directory_v1', auth: authClient });
  const response = await service.orgunits.list({
    customerId: CURRENT_CUSTOMER,
  });
  return response.data;
}

async function getCustomerId(authToken) {
  const authClient = await getAuthClient(
    ['https://www.googleapis.com/auth/admin.directory.customer.readonly'],
    authToken
  );
  const service = google.admin({ version: 'directory_v1', auth: authClient });
  const response = await service.customers.get({
    customerKey: CURRENT_CUSTOMER,
  });
  return response.data;
}

export { listChromeActivities, listOrgUnits, getCustomerId };
