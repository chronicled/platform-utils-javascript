# platform-utils-js

Exports basic utility libraries for use in platform components

This repository exports the following utility libraries:

- Config
- Logger

## Usage

Configuration will by default be loaded from 'config-local.yml', 'config-local.yaml', or 'config-local.json' in that order. You may override the configuration path by setting CONFIG_PATH in the environment to a relative or absolute path to your YAML or JSON config file.

### To Test

- Execute `npm run test`

## Releasing

All you need to release a new version is to tag a specific commit with an updated package.json version. CircleCI will publish that version to the package registry after a build on that tag is completed. Versions need to follow semantic versioning.

Example command: `TAG=1.1.0-1 make release`
