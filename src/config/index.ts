import * as fs from 'fs';
import * as _ from 'lodash';
import * as nconfYaml from 'nconf-yaml';
import { Config } from './base';

const DEFAULT_CONFIG_PATH = 'config-local.yaml';
const USER_CONFIG_PATH = process.env.CONFIG_PATH || '';
let USER_CONFIG_FORMAT: null | typeof nconfYaml;

if (USER_CONFIG_PATH.endsWith('.json')) {
  USER_CONFIG_FORMAT = null; // default
} else if (
  USER_CONFIG_PATH.endsWith('.yml') ||
  USER_CONFIG_PATH.endsWith('.yaml')
) {
  USER_CONFIG_FORMAT = nconfYaml;
} else if (USER_CONFIG_PATH !== '') {
  throw new Error(`Invalid config file format: '${USER_CONFIG_PATH}'`);
}

if (!fs.existsSync(USER_CONFIG_PATH) && !fs.existsSync(DEFAULT_CONFIG_PATH)) {
  console.error(
    `WARNING: Missing config file, please ensure it is present at '${
      USER_CONFIG_PATH || DEFAULT_CONFIG_PATH
    }' or set CONFIG_PATH.`
  );
}

Config.argv().env({ separator: '__' });

if (USER_CONFIG_PATH) {
  Config.add('user', {
    type: 'file',
    file: USER_CONFIG_PATH,
    format: USER_CONFIG_FORMAT
  });
}

Config.add('global', {
  type: 'file',
  file: DEFAULT_CONFIG_PATH,
  format: nconfYaml
});

Config.defaults({});

Config.addExpectedConfig([
  { name: 'CONFIG_PATH', default: USER_CONFIG_PATH || DEFAULT_CONFIG_PATH },
  { name: 'NODE_ENV', default: 'local' },
  { name: 'LOG_LEVEL', default: 'debug' },
  { name: 'LOG_CONSOLE_ENABLED', default: true },
  { name: 'LOG_FILE_ENABLED', default: false }
]);

export default {
  getWithDefault: <T = any>(name: string, other: T): T =>
    _.isNil(Config.get(name)) ? other : Config.get(name),
  get: <T = any>(name: string): T => Config.get(name),
  set: <T>(name: string, val: T): void => Config.set(name, val),
  addExpectedConfig: Config.addExpectedConfig,
  getAsBoolean: Config.getAsBoolean
};
