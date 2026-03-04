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

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

class Logger {
  constructor() {
    this.level = LogLevel.INFO
  }

  setLevel(level) {
    this.level = level
  }

  debug(...args) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(...args)
    }
  }

  info(...args) {
    if (this.level <= LogLevel.INFO) {
      console.log(...args)
    }
  }

  warn(...args) {
    if (this.level <= LogLevel.WARN) {
      console.warn(...args)
    }
  }

  error(...args) {
    if (this.level <= LogLevel.ERROR) {
      console.error(...args)
    }
  }
}

export const logger = new Logger()
