OAuth2-as-server
================

[![Known Vulnerabilities](https://snyk.io/test/github/cmsdevio/oauth2-as-server/badge.svg)](https://snyk.io/test/github/cmsdevio/oauth2-as-server)
[![Build Status](https://travis-ci.org/cmsdevio/oauth2-as-server.svg?branch=master)](https://travis-ci.org/cmsdevio/oauth2-as-server.svg)
[![codecov](https://codecov.io/gh/cmsdevio/oauth2-as-server/branch/develop/graph/badge.svg)](https://codecov.io/gh/cmsdevio/oauth2-as-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Compliant, well-tested, [hapi](https://github.com/hapijs/hapi) based OAuth2 server.

- [Features](#features)

Features
--------

* Supports `authorization_code`, `client_credentials`, and `refresh_token`, with scopes.
* Supports _Dynamic Client Registration_.
* [RFC 6749](https://tools.ietf.org/html/rfc6749.html) compliant.
* Currently supports _MongoDB_ as persistence store.

Supported Clients
-----------------

|    Client     |      DCR       | Authorization Code |  Refresh Token  |
| ------------- |     :---:      |        :---:       |      :---:      |
| [OAuth2 Swift](https://github.com/p2/OAuth2)  | Yes  | Yes  | TBD  |