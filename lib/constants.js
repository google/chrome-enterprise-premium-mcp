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
 * @file Centralized constants for the Chrome Enterprise Premium CLI.
 */

export const SERVICE_NAMES = {
  CHROME_MANAGEMENT: 'chromemanagement.googleapis.com',
  CHROME_POLICY: 'chromepolicy.googleapis.com',
  ADMIN_SDK: 'admin.googleapis.com',
  CLOUD_IDENTITY: 'cloudidentity.googleapis.com',
  LICENSING: 'licensing.googleapis.com',
  SERVICE_USAGE: 'serviceusage.googleapis.com',
}

export const SCOPES = {
  OPENID: 'openid',
  EMAIL: 'email',
  CHROME_MANAGEMENT_POLICY: 'https://www.googleapis.com/auth/chrome.management.policy',
  CHROME_MANAGEMENT_REPORTS_READONLY: 'https://www.googleapis.com/auth/chrome.management.reports.readonly',
  CHROME_MANAGEMENT_PROFILES_READONLY: 'https://www.googleapis.com/auth/chrome.management.profiles.readonly',
  ADMIN_REPORTS_AUDIT_READONLY: 'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  ADMIN_DIRECTORY_ORGUNIT_READONLY: 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
  ADMIN_DIRECTORY_CUSTOMER_READONLY: 'https://www.googleapis.com/auth/admin.directory.customer.readonly',
  LICENSING: 'https://www.googleapis.com/auth/apps.licensing',
  CLOUD_IDENTITY_POLICIES: 'https://www.googleapis.com/auth/cloud-identity.policies',
  SERVICE_USAGE: 'https://www.googleapis.com/auth/service.management',
  SERVICE_USAGE_READONLY: 'https://www.googleapis.com/auth/service.management.readonly',
  CLOUD_PLATFORM: 'https://www.googleapis.com/auth/cloud-platform',
}

export const BEARER_METHODS_SUPPORTED = ['header']
export const RESPONSE_TYPES_SUPPORTED = ['code']
export const OAUTH_ISSUER = 'https://accounts.google.com'

export const API_VERSIONS = {
  CHROME_MANAGEMENT: 'v1',
  ADMIN_REPORTS: 'reports_v1',
  ADMIN_DIRECTORY: 'directory_v1',
  CLOUD_IDENTITY: 'v1beta1',
  CHROME_POLICY: 'v1',
  LICENSING: 'v1',
  SERVICE_USAGE: 'v1',
}

export const CEP_CONSTANTS = {
  PRODUCT_ID: '101040',
  SKU_ID: '1010400001',
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

export const CLOUD_IDENTITY_SETTING_TYPES = {
  DLP_RULE: 'settings/rule.dlp',
  DETECTOR: 'settings/detector',
  DETECTOR_URL_LIST: 'settings/detector.url_list',
  DETECTOR_WORD_LIST: 'settings/detector.word_list',
  DETECTOR_REGEX: 'settings/detector.regular_expression',
}

export const CLOUD_IDENTITY_FILTERS = {
  DLP_RULE: 'setting.type.startsWith("settings/rule.dlp")',
  DETECTOR: 'setting.type.startsWith("settings/detector")',
}

export const POLICY_TYPES = {
  RULE: 'rule',
  DETECTOR: 'detector',
}

export const CONNECTOR_DISPLAY_NAMES = {
  uploadAnalysis: 'Upload content analysis',
  downloadAnalysis: 'File download analysis',
  pasteAnalysis: 'Paste/bulk text analysis',
  printAnalysis: 'Print analysis',
  realtimeUrlCheck: 'Real-time URL check',
  securityEventReporting: 'Security event reporting',
}

export const CONNECTOR_KEY_MAPPING = {
  serviceProvider: 'Provider',
  delayDeliveryUntilVerdict: 'Delay Enforcement',
  blockFileOnContentAnalysisFailure: 'Block on Failure',
  blockUntilVerdict: 'Block on Failure',
  blockPasswordProtectedFiles: 'Block Password Protected',
  blockLargeFileTransfer: 'Block Large Files',
  sensitiveUrlPatterns: 'Sensitive URLs',
  malwareUrlPatterns: 'Malware URLs',
  realtimeUrlCheckEnabled: 'Status',
}

export const POLICY_DISPLAY_NAMES = {
  ON_FILE_ATTACHED: 'Upload Content Analysis',
  ON_FILE_DOWNLOAD: 'File Download Analysis',
  ON_BULK_TEXT_ENTRY: 'Bulk Text Entry Analysis (paste)',
  ON_PRINT: 'Print Analysis',
  ON_REALTIME_URL_NAVIGATION: 'Real-Time URL Check',
  ON_SECURITY_EVENT: 'Event Reporting',
}

export const EVENT_NAME_MAPPING = {
  browserCrashEvent: 'Browser crash',
  browserExtensionInstallEvent: 'Browser extension install',
  contentTransferEvent: 'Content transfer',
  unscannedFileEvent: 'Content unscanned',
  dangerousDownloadEvent: 'Malware transfer',
  passwordChangedEvent: 'Password changed',
  passwordReuseEvent: 'Password reuse',
  sensitiveDataEvent: 'Sensitive data transfer',
  interstitialEvent: 'Unsafe site visit',
  urlFilteringInterstitialEvent: 'URL filtering interstitial',
  suspiciousUrlEvent: 'Suspicious URL',
}
