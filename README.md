# platform-utils-js

Exports basic utility libraries for use in platform components

This repository exports the following utility libraries:

- Config
- Logger
- Continuation local storage

## Usage

Configuration will by default be loaded from 'config-local.yml', 'config-local.yaml', or 'config-local.json' in that order. You may override the configuration path by setting CONFIG_PATH in the environment to a relative or absolute path to your YAML or JSON config file.

### To Test :

- RUN `node test.js`
