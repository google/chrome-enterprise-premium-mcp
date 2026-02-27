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

/**
 * @fileoverview Centralized constants for the Chrome Enterprise Premium CLI.
 */

export const SERVICE_NAMES = {
  CHROME_MANAGEMENT: 'chromemanagement.googleapis.com',
  ADMIN_SDK: 'admin.googleapis.com',
  CLOUD_IDENTITY: 'cloudidentity.googleapis.com',
}

export const SCOPES = {
  CHROME_MANAGEMENT_POLICY: 'https://www.googleapis.com/auth/chrome.management.policy',
  CHROME_MANAGEMENT_REPORTS_READONLY: 'https://www.googleapis.com/auth/chrome.management.reports.readonly',
  ADMIN_REPORTS_AUDIT_READONLY: 'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  ADMIN_DIRECTORY_ORGUNIT_READONLY: 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
  ADMIN_DIRECTORY_CUSTOMER_READONLY: 'https://www.googleapis.com/auth/admin.directory.customer.readonly',
  CLOUD_IDENTITY_POLICIES: 'https://www.googleapis.com/auth/cloud-identity.policies',
}

export const API_VERSIONS = {
  CHROME_MANAGEMENT: 'v1',
  ADMIN_REPORTS: 'reports_v1',
  ADMIN_DIRECTORY: 'directory_v1',
  CLOUD_IDENTITY: 'v1beta1',
  CHROME_POLICY: 'v1',
}

export const DEFAULT_CONFIG = {
  REGION: 'europe-west1',
  MAX_RETRIES: 7,
  INITIAL_BACKOFF_MS: 1000,
  FIRST_RETRY_BACKOFF_MS: 15000,
}

export const ERROR_MESSAGES = {
  INSUFFICIENT_SCOPES: 'Request had insufficient authentication scopes.',
  NO_CREDENTIALS: 'Could not load the default credentials.',
  QUOTA_PROJECT_NOT_SET: 'API requires a quota project, which is not set by default',
  PERMISSION_DENIED: 'Permission denied',
  API_NOT_ENABLED: api => `API [${api}] is not enabled.`,
}

export const TAGS = {
  AUTH: '[auth]',
  API: '[api]',
  CLI: '[cli]',
  MCP: '[mcp]',
}

export const CHROME_DLP_TRIGGERS = {
  FILE_UPLOAD: 'google.workspace.chrome.file.v1.upload',
  FILE_DOWNLOAD: 'google.workspace.chrome.file.v1.download',
  WEB_CONTENT_UPLOAD: 'google.workspace.chrome.web_content.v1.upload',
  PRINT: 'google.workspace.chrome.page.v1.print',
  URL_NAVIGATION: 'google.workspace.chrome.url.v1.navigation',
}

export const CLOUD_IDENTITY_SETTING_TYPES = {
  DLP_RULE: 'settings/rule.dlp',
  DETECTOR: 'settings/detector',
  DETECTOR_URL_LIST: 'settings/detector.url_list',
  DETECTOR_WORD_LIST: 'settings/detector.word_list',
  DETECTOR_REGEX: 'settings/detector.regular_expression',
}

export const CLOUD_IDENTITY_FILTERS = {
  DLP_RULE: 'setting.type.matches("rule.dlp")',
  DETECTOR: 'setting.type.matches("detector")',
}

export const POLICY_TYPES = {
  RULE: 'rule',
  DETECTOR: 'detector',
}

export const POLICY_STATES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
}
