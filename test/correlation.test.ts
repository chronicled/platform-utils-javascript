import * as fs from 'fs';
import { fetchLogs, getLogger, tmpLogFile } from './util';
import { withCorrelationContext, currentCorrelationContext } from '../src';

describe('Correlation', () => {
  let tmpLogFilePath: string;

  beforeAll(async () => {
    tmpLogFilePath = await tmpLogFile();
  });

  beforeEach((done) => {
    fs.writeFile(tmpLogFilePath, '', done);
  });

  test('Correlation IDs', (done) => {
    const correlationId = 'alpha';
    const causationId = '123';
    const messageId = '456';
    const tenantId = 'ten1';
    const inputMessage = { a: 1, b: 2, c: { d: 3 } };

    const verifyLogs = (error: Error | null, lines?: string[]) => {
      if (error) {
        return done(error);
      }

      if (!lines) {
        return done(new Error('Did not find logs'));
      }

      expect(lines).toHaveLength(9);

      lines.forEach((line) => {
        const log = JSON.parse(line);
        expect(log).toMatchObject({
          level: expect.any(String),
          tracing: {
            'correlation-id': correlationId,
            'causation-id': causationId,
            'message-id': messageId,
            'tenant-id': tenantId
          },
          payload: {},
          message: expect.stringContaining(' message'),
          timestamp: expect.any(String)
        });

        if (['trace', 'debug', 'error'].includes(log.level)) {
          expect(log.tracing).toMatchObject({
            'input-message': inputMessage
          });
        } else {
          expect(log.tracing).not.toContain('input-message');
        }
      });

      done();
    };

    const logger = getLogger('json');

    withCorrelationContext(
      { correlationId, causationId, messageId, tenantId, inputMessage },
      () => {
        logger.info('first log message');
        logger.trace('first trace message');
        logger.error('first error message');
        expect(currentCorrelationContext()).toEqual({
          correlationId,
          causationId,
          messageId,
          tenantId,
          inputMessage
        });

        setImmediate(() => {
          logger.info('second log message');
          logger.trace('second trace message');
          logger.error('second error message');
          expect(currentCorrelationContext()).toEqual({
            correlationId,
            causationId,
            messageId,
            tenantId,
            inputMessage
          });
        });

        setTimeout(() => {
          logger.info('third log message');
          logger.trace('third trace message');
          logger.error('third error message');
          expect(currentCorrelationContext()).toEqual({
            correlationId,
            causationId,
            messageId,
            tenantId,
            inputMessage
          });
          setTimeout(() => fetchLogs(tmpLogFilePath, verifyLogs), 1000);
        }, 100);
      }
    );
  });
});
