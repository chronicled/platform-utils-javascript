'use strict';
const Path = require('path');
const fs = require('fs');
const DEFAULT_CONFIG_NAME = 'config-local';
const Config = require('./base.js');
const _ = require('lodash');

/*
 * intialize heirarchy for lookup values
 * assign 'file' as literal store before loading config.json
 * to preserve its place in the heirarchy
 */
Config
  .argv()
  .env({ separator: '__' })
  .add('file', { type: 'literal', store: {} })
  .defaults({});

Config.addExpectedConfig([
  { name: 'NODE_ENV', default: 'local' },
  { name: 'LOG_LEVEL', default: 'debug' },
  { name: 'LOG_CONSOLE_ENABLED', default: true },
  { name: 'LOG_FILE_ENABLED', default: false }
]);

let configFile = Path.join(process.cwd(), DEFAULT_CONFIG_NAME);
try {
  // check if yaml file is present
  const configYaml = `${configFile}.yaml`;
  fs.accessSync(configYaml);
  configFile = configYaml;
  Config.add('file', { file: configFile, format: require('nconf-yaml') });
} catch (__) {
  try {
    const configJson = `${configFile}.json`;
    fs.accessSync(configJson);
    configFile = configJson;
    Config.add('file', { file: configFile });
  } catch (e) {
    /* eslint-disable no-console */
    console.log(`${new Date().toISOString()} - WARNING: Missing config file, please ensure it is present at the following path. `, configFile);
    /* eslint-enable no-console */
  }
}
Config.addExpectedConfig([
  { name: 'CONFIG_PATH', default: configFile }
]);

const ConfigModule = {
  getWithDefault: (name, other) => _.isNil(Config.get(name)) ? other : Config.get(name),
  get: (name) => Config.get(name),
  set: (name, val) => Config.set(name, val),
  addExpectedConfig: Config.addExpectedConfig,
  getAsBoolean: Config.getAsBoolean
};

module.exports = ConfigModule;
