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
  id: 'k21',
  priority: 'P2',
  tags: ['dlp', 'ocr'],
  requiredPatterns: ['OCR'],
  prompt: `Can CEP's DLP engine detect sensitive text like credit card numbers embedded inside images?`,
  goldenResponse: `Yes, Chrome Enterprise Premium's DLP engine can detect sensitive text within images by using Optical Character Recognition (OCR). This feature needs to be explicitly enabled in the Google Admin Console.`,
}
