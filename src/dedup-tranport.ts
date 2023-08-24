import Transport from 'winston-transport';
import crypto from 'crypto';
import winston from 'winston';
import './utils';
import _ from 'lodash';
import { constructLogger } from './logger';

type CacheItem = {
  timestamp: number;
  count: number;
};

export class WinstonDedup extends Transport {
  timeout: number;
  logger: winston.Logger;
  dedupCache: Map<string, CacheItem>;
  logRepetitionCount: number;
  constructor(options: any) {
    super(options);
    this.timeout = options.timeout || 15000;
    this.dedupCache = new Map<string, CacheItem>();
    this.logger = options.transport;
    this.logRepetitionCount = options.logRepetitionCount;
  }

  log(
    info: winston.LogEntry,
    callback: { (arg0: null, arg1: boolean): any; (): void }
  ): any {
    const { message, payload = {} } = info;
    // stringify the contents to hash
    const discardKeys = ['durationMs']; // remove timestamp related keys from payload, so the hash is not affected by unique keys
    const orderedPayload: { [key: string]: string } = {}; // order the payload keys for deterministic hash
    Object.keys(payload)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        if (!discardKeys.includes(key)) orderedPayload[key] = payload[key];
      });
    // hash the message + Stringified payload
    const logHash: string = crypto
      .createHash('md5')
      .update(message + JSON.safeStringify(orderedPayload))
      .digest('hex');
    const now = Date.now();
    const previousOccurrence = this.dedupCache.get(logHash);
    const previousCount: number = previousOccurrence?.count ?? 0;
    const timestamp = previousOccurrence?.timestamp ?? now;

    if (
      previousCount < this.logRepetitionCount &&
      now - timestamp < this.timeout
    ) {
      this.dedupCache.set(logHash, {
        timestamp,
        count: previousCount + 1
      });
      this.logger.log(info);
      // set timed clear only if new log
      if (previousCount === 0) {
        // If log cache timeout has exceeded, remove from cache
        setTimeout(() => {
          this.dedupCache.delete(logHash);
        }, this.timeout);
      }
    } else if (previousCount >= this.logRepetitionCount) {
      if (previousCount === this.logRepetitionCount) {
        const LoggerWithoutDedup = constructLogger(false);
        LoggerWithoutDedup.info(
          `Log line: ${JSON.stringify(
            info
          )} has repeated ${previousCount} times. Silencing it for sometime`
        );
      }
      this.dedupCache.set(logHash, {
        timestamp,
        count: previousCount + 1
      });
    }

    return callback(null, true);
  }
}
