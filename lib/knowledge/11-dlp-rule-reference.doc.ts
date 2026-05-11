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

import { generateDlpCelReference } from '../util/chrome_dlp_constants.js'

export const doc = {
  title: 'Chrome DLP Rule Configuration Reference',
  articleId: '11',
  summary:
    'Comprehensive technical reference for authoring Chrome DLP rules. Helps with CEL condition logic and action configuration. Covers 100+ Predefined Detectors, 286+ Web Categories, and trigger compatibility constraints. Keywords: matches_dlp_detector, url_category, CEL syntax, AUDIT/WARN/BLOCK behavior, MIME types.',
  content: generateDlpCelReference(),
}
