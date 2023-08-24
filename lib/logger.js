'use strict';
/* eslint no-console:0 */
const _ = require('lodash');
const logger = require('winston');
const util = require('util');
const Config = require('./config');
const pidPrefix = 'PID ' + process.pid;
const CLS = require('./cls');

function decorateLogger (logger) {
  const originalLog = logger.log;
  logger.log = function (level, msg, ...splat) {
    const noSplat = arguments.length <= 2;
    const updatedMsg = noSplat ? msg : util.format(msg, ...splat);
    return originalLog.call(this, level, updatedMsg);
  };
}

function customizeLogger () {
  var transports = [];
  var logLevels;

  logLevels = {
    levels: {
      debug: 0,
      info: 1,
      notice: 2,
      warning: 3,
      error: 4,
      crit: 5,
      alert: 6,
      emerg: 7
    }
  };

  if (Config.getAsBoolean('LOG_CONSOLE_ENABLED')) {
    transports.push(new logger.transports.Console({
      colorize: false,
      timestamp: true,
      level: Config.get('LOG_LEVEL').toLowerCase()
    }));
  }

  if (Config.getAsBoolean('LOG_FILE_ENABLED')) {
    Config.addExpectedConfig({
      name: 'LOG_FILE_PATH',
      default: '.'
    });
    transports.push(new logger.transports.File(), {
      filename: Config.get('LOG_FILE_PATH'),
      colorize: false,
      timestamp: true,
      json: false,
      level: Config.get('LOG_LEVEL').toLowerCase()
    });
  }

  const loggerEnhanced = logger.createLogger({
    exitOnError: false,
    transports: transports,
    format: logger.format.combine(
      logger.format.splat(),
      logger.format.simple(),
      logger.format.timestamp(),
      logger.format.printf(info => {
        const sessionId = CLS.get('sessionId') ? CLS.get('sessionId') : null;
        const logId = sessionId ? `[${sessionId}] - ` : `[${pidPrefix}] - `;
        return `${info.timestamp} - ${info.level}: ${logId} ${info.message}`;
      })
    )
  });

  loggerEnhanced.setLevels(logLevels.levels);
  decorateLogger(loggerEnhanced);
  loggerEnhanced.debug('Log levels: ' + (_.keys(logLevels.levels)));
  return loggerEnhanced;
}

module.exports = customizeLogger();
