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
 * @file Leveled logging utility for the MCP server.
 *
 * Exposes a singleton `logger` instance that supports DEBUG, INFO, WARN, and
 * ERROR levels. In Stdio transport mode all output is routed through stderr
 * so that stdout remains reserved for the MCP protocol.
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
}

/**
 * Leveled logger with optional stderr-only output for MCP Stdio transport.
 */
class Logger {
  /**
   * Creates a logger at INFO level with stdout routing.
   */
  constructor() {
    this.level = this._getInitialLogLevel()
    this.useStderr = false
  }

  /**
   * Determines the initial log level based on environment variables.
   * @returns {number} The initial log level.
   * @private
   */
  _getInitialLogLevel() {
    const envLevel = process.env.CEP_LOG_LEVEL?.toUpperCase()
    if (envLevel && LogLevel[envLevel] !== undefined) {
      return LogLevel[envLevel]
    }
    return LogLevel.INFO
  }

  /**
   * Sets the logging level.
   * @param {number} level - The new log level from the LogLevel enum.
   */
  setLevel(level) {
    this.level = level
  }

  /**
   * Routes all output to stderr. Required for MCP Stdio transport, where
   * stdout is reserved for protocol messages.
   */
  enableStdioMode() {
    this.useStderr = true
  }

  /**
   * Dispatches to the requested console method, or to console.error in
   * stderr-only mode.
   * @param {string} method - The console method to call (e.g., 'log', 'warn', 'error').
   * @param {...unknown} args - The arguments to log.
   * @private
   */
  _log(method, ...args) {
    if (this.useStderr) {
      console.error(...args)
    } else {
      console[method](...args)
    }
  }

  /**
   * Log at DEBUG level.
   * @param {...unknown} args - The arguments to log.
   */
  debug(...args) {
    if (this.level <= LogLevel.DEBUG) {
      this._log('log', ...args)
    }
  }

  /**
   * Log at INFO level.
   * @param {...unknown} args - The arguments to log.
   */
  info(...args) {
    if (this.level <= LogLevel.INFO) {
      this._log('log', ...args)
    }
  }

  /**
   * Log at WARN level.
   * @param {...unknown} args - The arguments to log.
   */
  warn(...args) {
    if (this.level <= LogLevel.WARN) {
      this._log('warn', ...args)
    }
  }

  /**
   * Log at ERROR level.
   * @param {...unknown} args - The arguments to log.
   */
  error(...args) {
    if (this.level <= LogLevel.ERROR) {
      this._log('error', ...args)
    }
  }
}

export const logger = new Logger()
