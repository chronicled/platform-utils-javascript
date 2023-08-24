import * as _ from 'lodash';
import { Provider } from 'nconf';

export interface ConfigEnt<T = any> {
  name: string;
  default?: T;
  required?: boolean;
}

export interface ConfigProvider extends Provider {
  getAsBoolean(name: string): boolean;
  addExpectedConfig(entryOrList: ConfigEnt | ConfigEnt[]): this;
}

export const Config = new Provider() as ConfigProvider;

/*
 * nconf uses ':' as a delimeter but lodash uses '.' for its' _.set method.
 * This is used to swap to the lodash delimter
 */
function swapDelimiter(str: string): string {
  return str.replace(/:/g, '.');
}

function addDefault(configEntry: ConfigEnt): void {
  const newDefault = {};
  _.set(newDefault, swapDelimiter(configEntry.name), configEntry.default);
  const newStore = _.merge({}, Config.stores.defaults.store, newDefault);
  Config.defaults(newStore);
}

function evalBool(value: any): boolean {
  const valString = String(value).toLowerCase();
  return (
    valString.indexOf('yes') >= 0 ||
    valString.indexOf('true') >= 0 ||
    valString.indexOf('ok') >= 0 ||
    valString.indexOf('enable') >= 0
  );
}

Config.getAsBoolean = (name) => {
  const val = Config.get(name);
  return _.isBoolean(val) ? val : evalBool(val);
};

// eslint-disable-next-line space-before-function-paren
Config.addExpectedConfig = function (entryOrList) {
  const entries = Array.isArray(entryOrList) ? entryOrList : [entryOrList];
  entries.filter((entry) => !_.isNil(entry.default)).forEach(addDefault);
  Config.required(entries.filter((e) => e.required).map((e) => e.name));
  return this;
};
