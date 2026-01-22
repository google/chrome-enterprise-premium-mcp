/*
Copyright 2025 Google LLC

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

import {
  registerCountBrowserVersionsTool,
  registerHelloTool,
  registerCustomerProfileTool,
  registerListDlpRulesTool,
  registerCreateDlpRuleTool,
  registerGetChromeActivityLogTool,
  registerAnalyzeChromeLogsTool,
  registerDeleteDlpRuleTool,
  registerCreateUrlListTool,
} from './register-tools.js';

export const registerTools = (
  server,
  options = {}
) => {
  registerCountBrowserVersionsTool(server, options);
  registerHelloTool(server, options);
  registerCustomerProfileTool(server, options);
  registerListDlpRulesTool(server, options);
  registerCreateDlpRuleTool(server, options);
  registerGetChromeActivityLogTool(server, options);
  registerAnalyzeChromeLogsTool(server, options);
  registerDeleteDlpRuleTool(server, options);
  registerCreateUrlListTool(server, options);
};

export const registerToolsRemote = (
  server,
  options = {}
) => {
  registerCountBrowserVersionsTool(server, options);
  registerHelloTool(server, options);
  registerCustomerProfileTool(server, options);
  registerListDlpRulesTool(server, options);
  registerCreateDlpRuleTool(server, options);
  registerGetChromeActivityLogTool(server, options);
  registerAnalyzeChromeLogsTool(server, options);
  registerDeleteDlpRuleTool(server, options);
  registerCreateUrlListTool(server, options);
};
