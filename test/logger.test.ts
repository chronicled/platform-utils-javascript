import * as fs from 'fs';
import { DedupConfig, fetchLogs, getLogger, tmpLogFile } from './util';
import { ChronicledLogLevels } from '../src/logger';
import { Config } from '../src/config/base';

describe('Logger', () => {
  let tmpLogFilePath: string;

  beforeAll(async () => {
    tmpLogFilePath = await tmpLogFile();
  });

  beforeEach((done) => {
    fs.writeFile(tmpLogFilePath, '', done);
  });

  const logsToSend: [keyof ChronicledLogLevels, [string, ...any]][] = [
    ['trace', ['(C)hronicled debug 1']],
    ['trace', ['(C)hronicled debug 2', { a: 1, b: 2, c: { d: 3 } }]],
    ['debug', ['(C)hronicled debug 3']],
    ['debug', ['(C)hronicled debug 4', { a: 1, b: 2, c: { d: 3 } }]],
    ['info', ['(C)hronicled info 1']],
    ['info', ['(C)hronicled info 2', { a: 1, b: 2, c: { d: 3 } }]],
    ['notice', ['(C)hronicled notice 1']],
    ['notice', ['(C)hronicled notice 2', { a: 1, b: 2, c: { d: 3 } }]],
    ['warning', ['(C)hronicled warning 1']],
    ['warning', ['(C)hronicled warning 2', { a: 1, b: 2, c: { d: 3 } }]],
    ['error', ['(C)hronicled error 1']],
    ['error', ['(C)hronicled error 2', { a: 1, b: 2, c: { d: 3 } }]],
    ['fatal', ['Crit: Reactor over temp! 1']],
    ['fatal', ['Crit: Reactor over temp! 2', { a: 1, b: 2, c: { d: 3 } }]]
  ];

  test('json log format', (done) => {
    const verifyLogs = (error: Error | null, lines?: string[]) => {
      if (error) {
        return done(error);
      }

      if (!lines) {
        return done(new Error('Did not find logs'));
      }

      expect(lines).toHaveLength(logsToSend.length);

      lines.forEach((line, i) => {
        const expectedLog = logsToSend[i][1];
        const log = JSON.parse(line);

        expect(log).toMatchObject({
          level: expect.any(String),
          timestamp: expect.any(String),
          tracing: expect.any(Object),
          message: expectedLog[0],
          payload: expectedLog[1] || {}
        });
      });

      done();
    };

    const logger = getLogger('json');

    logsToSend.forEach(([logMethod, logArgs]) => {
      (logger[logMethod] as any).apply(logger, logArgs);
    });

    logger.on('finish', function () {
      setTimeout(() => fetchLogs(tmpLogFilePath, verifyLogs), 1000);
    });

    logger.end();
  });

  test('txt log format', (done) => {
    const verifyLogs = (error: Error | null, lines?: string[]) => {
      if (error) {
        return done(error);
      }

      if (!lines) {
        return done(new Error('Did not find logs'));
      }

      expect(lines).toHaveLength(logsToSend.length);

      lines.forEach((line, i) => {
        const expectedLog = logsToSend[i][1];
        // Loose validation because we're not interested in txt in production.
        expect(line).toContain(expectedLog[0]);
      });

      done();
    };

    const logger = getLogger('txt');

    logsToSend.forEach(([logMethod, logArgs]) => {
      (logger[logMethod] as any).apply(logger, logArgs);
    });

    logger.on('finish', function () {
      setTimeout(() => fetchLogs(tmpLogFilePath, verifyLogs), 1000);
    });

    logger.end();
  });

  test('log deduplication should print only 2 repetitions every 3ms', (done) => {
    const verifyLogs = (error: Error | null, lines?: string[]) => {
      if (error) {
        return done(error);
      }

      if (!lines) {
        return done(new Error('Did not find logs'));
      }

      expect(lines).toHaveLength(
        parseInt(Config.get('LOG_ALLOWED_REPETITIONS')) * 2 + 2
      ); // adds 2 lines that mention about repeat log silencing

      logger.end();
      done();
    };

    const dedupConfig: DedupConfig = {
      LOG_ALLOWED_REPETITIONS: 2,
      LOG_CACHE_TIMEOUT: 0.003
    };
    const logger = getLogger('json', dedupConfig);

    for (let i = 0; i <= 1000; i++) {
      logger
        .child({ durationMs: i, fruit: 'apple' })
        .info('This log will be repeated');
    }

    // write logs after a delay so that cache gets cleared
    setTimeout(() => {
      for (let i = 1001; i <= 2000; i++) {
        logger
          .child({ durationMs: i, fruit: 'apple' })
          .info('This log will be repeated');
      }
    }, 20);

    setTimeout(() => fetchLogs(tmpLogFilePath, verifyLogs), 1000);
  });
});
