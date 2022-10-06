# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.38.0](https://github.com/tim-smart/droff/compare/droff@0.37.0...droff@0.38.0) (2022-10-06)

### Bug Fixes

- **droff:** make arrays in axios data work ([45bca0f](https://github.com/tim-smart/droff/commit/45bca0f301474f1b51aacc796058cee56054e465))

### Features

- try out weakref for cache ([6b4338f](https://github.com/tim-smart/droff/commit/6b4338f3fda74cac423900d0440cb96f9aa36625))

# [0.37.0](https://github.com/tim-smart/droff/compare/droff@0.36.0...droff@0.37.0) (2022-10-05)

### Features

- use resume_gateway_url for resumes ([016f090](https://github.com/tim-smart/droff/commit/016f0907792c530dcd8a1792e2c3821b5448a567))

# [0.36.0](https://github.com/tim-smart/droff/compare/droff@0.36.0-alpha.1...droff@0.36.0) (2022-10-03)

**Note:** Version bump only for package droff

# [0.36.0-alpha.1](https://github.com/tim-smart/droff/compare/droff@0.36.0-alpha.0...droff@0.36.0-alpha.1) (2022-09-29)

### Bug Fixes

- remove dev dependencies from dependencies ([f052a93](https://github.com/tim-smart/droff/commit/f052a93201c6f392b0a4810361dd6428ccfbc05a))

# [0.36.0-alpha.0](https://github.com/tim-smart/droff/compare/droff@0.35.0...droff@0.36.0-alpha.0) (2022-09-28)

### chore

- Update api types ([59f4ae8](https://github.com/tim-smart/droff/commit/59f4ae8c88f98a119cb30dcf261d55efc38f44fd))

### BREAKING CHANGES

- GatewayEvent* renamed to ReceiveEvent*

# [0.35.0](https://github.com/tim-smart/droff/compare/droff@0.34.2...droff@0.35.0) (2022-08-26)

### chore

- update api types ([3939737](https://github.com/tim-smart/droff/commit/3939737cde03648717a46a8bf5747e9053c7af8c))

### BREAKING CHANGES

- renames some of the channel type constants

## [0.34.2](https://github.com/tim-smart/droff/compare/droff@0.34.1...droff@0.34.2) (2022-08-12)

**Note:** Version bump only for package droff

## [0.34.1](https://github.com/tim-smart/droff/compare/droff@0.34.0...droff@0.34.1) (2022-06-30)

**Note:** Version bump only for package droff

# [0.34.0](https://github.com/tim-smart/droff/compare/droff@0.33.0...droff@0.34.0) (2022-06-29)

### chore

- update api types ([f1971af](https://github.com/tim-smart/droff/commit/f1971afcffebd1cf6a067dd25f49c29b60e4cf74))

### Features

- update api version to v10 ([6f99057](https://github.com/tim-smart/droff/commit/6f990579c014462d4e7dc80f58c30c7a4dd3fa4f))

### BREAKING CHANGES

- Significant API changes

# [0.33.0](https://github.com/tim-smart/droff/compare/droff@0.32.2...droff@0.33.0) (2022-05-27)

### chore

- update api types ([bf18e21](https://github.com/tim-smart/droff/commit/bf18e217ce1abad65a122f43980ac6d5ad0c7f9b))
- update api types ([5de9ff2](https://github.com/tim-smart/droff/commit/5de9ff2483d35eace71fcb71b137fc1a6e6bfa5b))

### BREAKING CHANGES

- some discord api types have breaking changes
- renames startThreadWithMessage

## [0.32.2](https://github.com/tim-smart/droff/compare/droff@0.32.1...droff@0.32.2) (2022-03-30)

**Note:** Version bump only for package droff

## [0.32.1](https://github.com/tim-smart/droff/compare/droff@0.32.0...droff@0.32.1) (2022-03-25)

**Note:** Version bump only for package droff

# [0.32.0](https://github.com/tim-smart/droff/compare/droff@0.31.0...droff@0.32.0) (2022-03-11)

### Code Refactoring

- remove latency from sharder store ([65cde5c](https://github.com/tim-smart/droff/commit/65cde5ca51309d14e0cb4973d6581d06c2921422))

### BREAKING CHANGES

- latency removed from sharder heartbeat

# [0.31.0](https://github.com/tim-smart/droff/compare/droff@0.30.2...droff@0.31.0) (2022-03-11)

### Features

- add latency$ to shard ([d3719a6](https://github.com/tim-smart/droff/commit/d3719a609ed7f4bafac2165446c08e56b5cca3c5))
- send latency to sharder store ([cd020ae](https://github.com/tim-smart/droff/commit/cd020ae7cb9dc612b66f19b8ccdbb707cdafa276))

## [0.30.2](https://github.com/tim-smart/droff/compare/droff@0.30.1...droff@0.30.2) (2022-03-11)

**Note:** Version bump only for package droff

## [0.30.1](https://github.com/tim-smart/droff/compare/droff@0.30.0...droff@0.30.1) (2022-03-11)

**Note:** Version bump only for package droff

# [0.30.0](https://github.com/tim-smart/droff/compare/droff@0.29.1...droff@0.30.0) (2022-03-10)

### Bug Fixes

- absorb null in invite cache ([e5b6f90](https://github.com/tim-smart/droff/commit/e5b6f904c1ca4d2d30b79dd42f1938f0862d3e48))

### Features

- add load balanced send method to gateway client ([0059b9e](https://github.com/tim-smart/droff/commit/0059b9e8b7fb589b40078ae38ef312c0df89421f))
- Add presence option to gateway ([46b2190](https://github.com/tim-smart/droff/commit/46b2190f05239aa4f9bf4f6f4c66a5127b975e0d))
- **caches:** simplify CrudObservables ([14f8fa3](https://github.com/tim-smart/droff/commit/14f8fa34d55173a38c72303ab4c92974e985a1f5))

## [0.29.1](https://github.com/tim-smart/droff/compare/droff@0.29.0...droff@0.29.1) (2022-03-10)

### Bug Fixes

- package.json import ([61affaa](https://github.com/tim-smart/droff/commit/61affaa6031680bfa83a105535c6f26205d232df))

# [0.29.0](https://github.com/tim-smart/droff/compare/droff@0.28.0...droff@0.29.0) (2022-03-10)

**Note:** Version bump only for package droff

# [0.28.0](https://github.com/tim-smart/droff/compare/droff@0.27.6...droff@0.28.0) (2022-03-09)

### Features

- update api types ([80167d5](https://github.com/tim-smart/droff/commit/80167d5c657d7314394648bc78fa6fa8f9051214))

## [0.27.6](https://github.com/tim-smart/droff/compare/droff@0.27.5...droff@0.27.6) (2022-03-09)

### Bug Fixes

- catch get gateway bot errors ([1d6ed57](https://github.com/tim-smart/droff/commit/1d6ed57a8fb63c7de919b4a04d05a847db368864))

## [0.27.5](https://github.com/tim-smart/droff/compare/droff@0.27.4...droff@0.27.5) (2022-03-07)

**Note:** Version bump only for package droff

## [0.27.4](https://github.com/tim-smart/droff/compare/droff@0.27.3...droff@0.27.4) (2022-03-07)

### Bug Fixes

- Add default store type to factory fn types ([0c8226f](https://github.com/tim-smart/droff/commit/0c8226fc809bfe56aa3e28bc5b6c60a3daded07f))

## [0.27.3](https://github.com/tim-smart/droff/compare/droff@0.27.2...droff@0.27.3) (2022-03-07)

**Note:** Version bump only for package droff

## [0.27.2](https://github.com/tim-smart/droff/compare/droff@0.27.1...droff@0.27.2) (2022-03-07)

### Bug Fixes

- **rate-limits:** use parseFloat for retryAfter helper ([4de90a7](https://github.com/tim-smart/droff/commit/4de90a7d9a36f4b107dac64cb57d66a9e34296f8))

## [0.27.1](https://github.com/tim-smart/droff/compare/droff@0.27.0...droff@0.27.1) (2022-03-06)

### Bug Fixes

- Correctly parse decimal reset after headers ([ebc039e](https://github.com/tim-smart/droff/commit/ebc039ecc4d73ccc6227639c49042fa8dd9a9163))

# [0.27.0](https://github.com/tim-smart/droff/compare/droff@0.26.0...droff@0.27.0) (2022-03-06)

### Features

- Add \*WithTTL cache store variants ([6b77fa0](https://github.com/tim-smart/droff/commit/6b77fa0147634420a0abf1e1a2fcc4a92de641b4))
- Add DM cache ([32b0ff5](https://github.com/tim-smart/droff/commit/32b0ff5078fee158ba29038e1943090d33f46de7))

# [0.26.0](https://github.com/tim-smart/droff/compare/droff@0.25.0...droff@0.26.0) (2022-03-06)

### Features

- Add strategy option to ttl cache store ([2933719](https://github.com/tim-smart/droff/commit/293371990b56a706e9f44c80e6bd9c995f37ff8b))

# [0.25.0](https://github.com/tim-smart/droff/compare/droff@0.24.1...droff@0.25.0) (2022-03-06)

### Features

- **interactions:** make respond helper more explicit ([15a1f37](https://github.com/tim-smart/droff/commit/15a1f376b588494d06a44918f2b22df478a5623a))
- simple cache memory store with ttl ([484cbeb](https://github.com/tim-smart/droff/commit/484cbeb608c6812a25ca61aff54eb19087beba1a))

## [0.24.1](https://github.com/tim-smart/droff/compare/droff@0.24.0...droff@0.24.1) (2022-03-05)

**Note:** Version bump only for package droff

# [0.24.0](https://github.com/tim-smart/droff/compare/droff@0.23.1...droff@0.24.0) (2022-03-04)

### Features

- stagger rate limot store delays ([e4c396e](https://github.com/tim-smart/droff/commit/e4c396e58a63c9a86d3ea20a3e33d2e3eb8daac8))
- tidy up rate limit store interface ([1775497](https://github.com/tim-smart/droff/commit/17754973b6404a4f0a6e47d584f3341d4f68db53))

## [0.23.1](https://github.com/tim-smart/droff/compare/droff@0.23.0...droff@0.23.1) (2022-03-04)

**Note:** Version bump only for package droff

# [0.23.0](https://github.com/tim-smart/droff/compare/droff@0.22.1...droff@0.23.0) (2022-03-04)

### Bug Fixes

- shardsReady$ waits for ready events ([19ce920](https://github.com/tim-smart/droff/commit/19ce920bdbd743d51365a2b7d29c44e58456d5a1))

### Features

- Add allClaimed to shard store ([c44a3ed](https://github.com/tim-smart/droff/commit/c44a3ed3091e8de620a0b23a15e596b2040993d4))
- Add shardsReady$ to gateway client ([2ae6c95](https://github.com/tim-smart/droff/commit/2ae6c95165ecbfbcccfa5af102b861fe0cb7edff))

## [0.22.1](https://github.com/tim-smart/droff/compare/droff@0.22.0...droff@0.22.1) (2022-03-04)

### Bug Fixes

- memory leak with unused error queue ([29cfc39](https://github.com/tim-smart/droff/commit/29cfc39fcd3b0bde4c28bbe77e035b2c65d086a9))

# [0.22.0](https://github.com/tim-smart/droff/compare/droff@0.21.2...droff@0.22.0) (2022-03-03)

### Features

- Allow rest params to be optional ([b795d01](https://github.com/tim-smart/droff/commit/b795d013a17f15888368e673f593f4c5e6849e44))

## [0.21.2](https://github.com/tim-smart/droff/compare/droff@0.21.1...droff@0.21.2) (2022-03-03)

**Note:** Version bump only for package droff

## [0.21.1](https://github.com/tim-smart/droff/compare/droff@0.21.0...droff@0.21.1) (2022-03-03)

**Note:** Version bump only for package droff

# [0.21.0](https://github.com/tim-smart/droff/compare/droff@0.21.0-alpha.4...droff@0.21.0) (2022-03-03)

**Note:** Version bump only for package droff

# [0.21.0-alpha.4](https://github.com/tim-smart/droff/compare/droff@0.21.0-alpha.3...droff@0.21.0-alpha.4) (2022-03-03)

**Note:** Version bump only for package droff

# [0.21.0-alpha.3](https://github.com/tim-smart/droff/compare/droff@0.21.0-alpha.2...droff@0.21.0-alpha.3) (2022-03-02)

**Note:** Version bump only for package droff

# [0.21.0-alpha.2](https://github.com/tim-smart/droff/compare/droff@0.21.0-alpha.1...droff@0.21.0-alpha.2) (2022-03-02)

**Note:** Version bump only for package droff

# [0.21.0-alpha.1](https://github.com/tim-smart/droff/compare/droff@0.21.0-alpha.0...droff@0.21.0-alpha.1) (2022-03-02)

**Note:** Version bump only for package droff

## [0.20.1](https://github.com/tim-smart/droff/compare/droff@0.20.1-alpha.4...droff@0.20.1) (2022-03-01)

**Note:** Version bump only for package droff
