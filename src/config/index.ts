import * as fs from 'fs';
import * as _ from 'lodash';
import * as nconfYaml from 'nconf-yaml';
import { Config, ConfigProvider } from './base';

const DEFAULT_CONFIG_NAME = 'config-local';

/** Log a message, before logging is initialized. Pass process,stdout or process.stderr */
function lowLog(stream: any, message: string): void {
  stream.write(`${new Date().toISOString()} - ${message}\n`);
}

/*
 * intialize heirarchy for lookup values
 * assign 'file' as literal store before loading config.json
 * to preserve its place in the heirarchy
 */
Config.argv()
  .env({ separator: '__' })
  .add('file', { type: 'literal', store: {} })
  .defaults({});

Config.addExpectedConfig([
  { name: 'NODE_ENV', default: 'local' },
  { name: 'LOG_LEVEL', default: 'debug' },
  { name: 'LOG_CONSOLE_ENABLED', default: true },
  { name: 'LOG_FILE_ENABLED', default: false }
]);

function findConfigFile(): null | string {
  const envConfig = process.env.CONFIG_PATH;
  const extensions = ['', '.yml', '.yaml', '.json'];
  const fileNames: string[] = [];
  if (envConfig) fileNames.push(envConfig);
  fileNames.push(DEFAULT_CONFIG_NAME);
  for (var fileName of fileNames) {
    for (var extension of extensions) {
      const path = fileName + extension;
      if (fs.existsSync(path)) {
        return path;
      }
    }
  }
  return null;
}

function readConfigFile(conf: ConfigProvider): ConfigProvider {
  const configFile = findConfigFile();
  if (configFile) {
    let format = null;
    if (configFile.endsWith('.json')) {
      format = null; // default
    } else if (configFile.endsWith('.yml') || configFile.endsWith('.yaml')) {
      format = nconfYaml;
    } else {
      throw new Error(`Invalid config file format: '${configFile}'`);
    }
    lowLog(process.stdout, `Loading configuration at '${configFile}'`);
    conf.add('file', { file: configFile, format });
  } else {
    const expectedConfigPath =
      process.env.CONFIG_PATH || DEFAULT_CONFIG_NAME + '.yml';
    lowLog(
      process.stderr,
      `WARNING: Missing config file, please ensure it is present at '${expectedConfigPath}' or set CONFIG_PATH.`
    );
  }
  conf.addExpectedConfig([{ name: 'CONFIG_PATH', default: configFile }]);
  return conf;
}

readConfigFile(Config);

export default {
  getWithDefault: (name: string, other: any): boolean =>
    _.isNil(Config.get(name)) ? other : Config.get(name),
  get: (name: string): any => Config.get(name),
  set: (name: string, val: any): void => Config.set(name, val),
  addExpectedConfig: Config.addExpectedConfig,
  getAsBoolean: Config.getAsBoolean
};
