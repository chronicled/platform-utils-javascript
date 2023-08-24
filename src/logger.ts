'use strict';
/* eslint no-console:0 */

import * as util from 'util';
import * as logger from 'winston';
import Config from './config';
import CLS from './cls';

type FormattedLogMethod = (
  level: string,
  msg: string,
  ...splat: any[]
) => logger.Logger;

export interface ExtendedLogger extends logger.Logger {
  logf: FormattedLogMethod;
}

function decorateLogger(logger: logger.Logger): ExtendedLogger {
  var extendedLogger = logger as ExtendedLogger;
  extendedLogger.logf = function(
    level: string,
    msg: string,
    ...splat: any[]
  ): logger.Logger {
    const noSplat = arguments.length <= 2;
    const updatedMsg = noSplat ? msg : util.format(msg, ...splat);
    return extendedLogger.log(level, updatedMsg);
  };
  return extendedLogger;
}

function constructLogger(): ExtendedLogger {
  const pidPrefix = 'PID ' + process.pid.toString();
  var transports = [];
  const logLevels = {
    debug: 7,
    info: 6,
    notice: 5,
    warn: 4,
    warning: 4,
    error: 3,
    crit: 2,
    alert: 1,
    emerg: 0
  };

  if (Config.getAsBoolean('LOG_CONSOLE_ENABLED')) {
    const opts: any = {
      colorize: false,
      timestamp: true,
      level: Config.get('LOG_LEVEL').toLowerCase()
    };
    transports.push(new logger.transports.Console(opts));
  }

  if (Config.getAsBoolean('LOG_FILE_ENABLED')) {
    Config.addExpectedConfig({
      name: 'LOG_FILE_PATH',
      default: '.'
    });
    transports.push(
      new logger.transports.File({
        filename: Config.get('LOG_FILE_PATH'),
        level: Config.get('LOG_LEVEL').toLowerCase()
      })
    );
  }

  const loggerEnhanced = logger.createLogger({
    exitOnError: false,
    transports: transports,
    format: logger.format.combine(
      logger.format.splat(),
      logger.format.simple(),
      logger.format.timestamp(),
      logger.format.printf(info => {
        const logId = CLS.get('sessionId') || pidPrefix;
        return `${info.timestamp} - ${info.level}: [${logId}] - ${info.message}`;
      })
    ),
    levels: logLevels
  });

  return decorateLogger(loggerEnhanced);
}

export default constructLogger();
