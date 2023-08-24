import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { Config, constructLogger } from '../src';

const tmpDir = os.tmpdir();
const sep = path.sep;
const mkdtempPromise = promisify(fs.mkdtemp);

export type Callback<T, E extends Error = Error> = (
  error: E | null,
  result?: T
) => void;

export type DedupConfig = {
  [x: string]: number;
};

export function mkTmpDir(prefix: string): Promise<string> {
  return mkdtempPromise(`${tmpDir}${sep}${prefix}_`);
}

export function getLogger(
  format: 'json' | 'txt',
  dedupConfig: DedupConfig = {}
) {
  Config.set('LOG_CONSOLE_ENABLED', false);
  Config.set('LOG_LEVEL', 'trace');
  Config.set('LOG_FORMAT', format);

  for (let key in dedupConfig) {
    Config.set(key, dedupConfig[key]);
  }
  return constructLogger();
}

export function fetchLogs(logFile: string, cb: Callback<string[]>) {
  fs.readFile(logFile, { encoding: 'utf8' }, (error, content) => {
    if (error) {
      return cb(error);
    }

    cb(null, content.trim().split('\n'));
  });
}

export async function tmpLogFile(): Promise<string> {
  const directory = await mkTmpDir('chronicled_platform_utils_js');

  const tmpLogFile = `${directory}/logs`;
  Config.set('LOG_FILE_ENABLED', true);
  Config.set('LOG_FILE_PATH', tmpLogFile);
  console.log(`Temporary log file: ${directory}/logs`);

  return tmpLogFile;
}
