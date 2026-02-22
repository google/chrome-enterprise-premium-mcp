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
