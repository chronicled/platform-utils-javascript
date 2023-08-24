'use strict';
const _ = require('lodash');
const conf = require('nconf');

/*
 * nconf uses ':' as a delimeter but lodash uses '.' for its' _.set method.
 * This is used to swap to the lodash delimter
 */
const swapDelimiter = str => str.replace(/:/g, '.');

conf.getAsBoolean = function getBoolean (name) {
  const val = conf.get(name);
  return _.isBoolean(val) ? val : evalBool(val);
};

conf.addExpectedConfig = function addRequired (entryOrList) {
  const entries = Array.isArray(entryOrList) ? entryOrList : [entryOrList];
  entries.filter(entry => !_.isNil(entry.default)).forEach(addDefault);
  conf.required(entries.filter(e => e.required).map(e => e.name));
};

module.exports = conf;

function addDefault (configEntry) {
  const newDefault = {};
  _.set(newDefault, swapDelimiter(configEntry.name), configEntry.default);
  const newStore = _.merge({}, conf.stores.defaults.store, newDefault);
  conf.defaults(newStore);
}

function evalBool (value) {
  const valString = String(value).toLowerCase();
  return (valString.indexOf('yes') >= 0 || valString.indexOf('true') >= 0 || valString.indexOf('ok') >= 0 || valString.indexOf('enable') >= 0);
}
