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

export default {
  id: 'k33',
  priority: 'P1',
  tags: ['unenroll'],
  prompt: 'How do we unenroll a device and remove Chrome Enterprise management policies?',
  goldenResponse: `To unenroll a browser from Chrome Browser Cloud Management, you must remove the enrollment token from the device. This is located in the Windows Registry or as a file on macOS/Linux. You must then delete the device from the 'Managed browsers' list in the Google Admin Console to fully terminate management and free up the license. The process is described.`,
}
