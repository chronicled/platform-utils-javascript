/* eslint no-console:0 */

import * as winston from 'winston';
import { AbstractConfigSetLevels } from 'winston/lib/winston/config';
import { ConsoleTransportOptions } from 'winston/lib/winston/transports';
import Config from './config';
import { currentCorrelationContext } from './correlation';
import { WinstonDedup } from './dedup-tranport';

type Transports = winston.LoggerOptions['transports'];

export interface ChronicledLogLevels {
  trace: number;
  debug: number;
  info: number;
  notice: number;
  warning: number;
  error: number;
  fatal: number;
}

type ChronicledLogLevel = keyof ChronicledLogLevels;

type Logger = winston.Logger &
  {
    [key in ChronicledLogLevel]: winston.LeveledLogMethod;
  };

const levels: ChronicledLogLevels = {
  trace: 6,
  debug: 5,
  info: 4,
  notice: 3,
  warning: 2,
  error: 1,
  fatal: 0
};

const traceLevels = new Set(['trace', 'debug', 'error']);

const addCorrelationContext = winston.format(
  (meta, options: { baseLevel: ChronicledLogLevel }) => {
    const correlationData = currentCorrelationContext();
    meta.tracing = {
      'correlation-id': correlationData?.correlationId,
      'causation-id': correlationData?.causationId,
      'message-id': correlationData?.messageId,
      'tenant-id': correlationData?.tenantId,
      ...(meta.tracing || {})
    };

    if (
      traceLevels.has(meta.level) ||
      (options.baseLevel && traceLevels.has(options.baseLevel))
    ) {
      meta.tracing['input-message'] = correlationData?.inputMessage;
    }

    return meta;
  }
);

function getFormat(): winston.Logform.Format {
  const formatConfig = Config.get('LOG_FORMAT');
  const formatLevel = Config.get('LOG_LEVEL');
  const formats: winston.Logform.Format[] = [
    winston.format.splat(),
    winston.format.metadata({
      key: 'payload',
      fillExcept: ['level', 'message']
    }),
    addCorrelationContext({ baseLevel: formatLevel }),
    winston.format.timestamp()
  ];

  if (formatConfig === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.simple(),
      winston.format.printf(
        (info) => `${info.timestamp} - ${info.level}: ${info.message}`
      )
    );
  }

  return winston.format.combine.apply(null, formats);
}

function getTransports(enableDedup: boolean = true): Transports {
  const transports: Transports = [];
  const level = Config.get('LOG_LEVEL').toLowerCase();
  const dedupCacheTimeout: number =
    parseFloat(Config.getWithDefault('LOG_CACHE_TIMEOUT', '30.0')) * 1000; // defaults to 30s
  const logRepetitionCount: number = Config.getWithDefault(
    'LOG_ALLOWED_REPETITIONS',
    10
  );

  if (Config.getAsBoolean('LOG_CONSOLE_ENABLED')) {
    const opts: ConsoleTransportOptions = {
      level,
      stderrLevels: ['warning', 'error', 'fatal']
    };
    if (enableDedup) {
      const dedupTransport: Transports = new WinstonDedup({
        timeout: dedupCacheTimeout,
        logRepetitionCount,
        transport: new winston.transports.Console({
          handleExceptions: true,
          ...opts
        })
      });
      transports.push(dedupTransport);
    } else {
      transports.push(new winston.transports.Console(opts));
    }
  }

  if (Config.getAsBoolean('LOG_FILE_ENABLED')) {
    Config.addExpectedConfig({ name: 'LOG_FILE_PATH', default: '.' });
    const filename = Config.get('LOG_FILE_PATH');
    if (enableDedup) {
      const dedupFileTransport: Transports = new WinstonDedup({
        timeout: dedupCacheTimeout,
        logRepetitionCount,
        transport: new winston.transports.File({ filename, level })
      });
      transports.push(dedupFileTransport);
    } else {
      transports.push(new winston.transports.File({ filename, level }));
    }
  }

  return transports;
}

function decorateLogger(logger: winston.Logger): asserts logger is Logger {
  Object.defineProperty(logger, 'warn', { value: logger.warning });
}

export function constructLogger(enableDedup: boolean = true): Logger {
  const logger = winston.createLogger({
    level: Config.get('LOG_LEVEL'),
    exitOnError: false,
    transports: getTransports(enableDedup),
    format: getFormat(),
    levels: (levels as unknown) as AbstractConfigSetLevels
  }) as Logger;

  decorateLogger(logger);

  return logger;
}

export default constructLogger();
