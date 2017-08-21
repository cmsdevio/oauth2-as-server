const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Path = require('path');
const Mongoose = require('mongoose');

const Handlebars = require('handlebars');
const Promise = require('bluebird');
// const Crypto = require('crypto');
// const Base64url = require('base64url');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const URL = require('url');
const Jose = require('jsrsasign');
const querystring = require('querystring');

const TokenUtils = require('./utils/token-util');
const OAuthUtils = require('./utils/oauth-util');
const Client = require('./utils/client-util');
const Models = require('./persistence/mongodb/models');

Mongoose.Promise = Promise;
Mongoose.set('debug', "true");
Mongoose.connect('mongodb://localhost/Oauth2', {useMongoClient: true});

/**************************************/
//            CATBOX CACHING
/**************************************/
const cacheOptions = {
    expiresIn: 60 * 60 * 1000,
    segment: 'requests'
};
const reqCacheClient = new Catbox.Client(CatboxMemory, cacheOptions);
/**************************************/

//TODO: move to env vars or something
const sharedTokenSecret = 'OCW6s6K5yAtdLI2b/7GZpzWQNmxwmb5IF1bb1xv9WHQoBH/+Y9WBMyb9OSJfGvS+2Iza8g0U2oZhupVIjvJw4HVHIYZIGdcJJhvnrI0i3kRIB1HWAz0eh2myjFs7B5ZHM2vYBHxYdXUnEceg11RhClAc3+jLuCTkaDYbHwhZehHBIiTiLb1fSoF7x70tUAGrikChsfSKx7Kr+OKca7osk79e57jG67qG2hK0jevV/SCM/nOmw0HFke62GHM8HkY3nIQTWQ1p4o3VUta80C9ADU3Cs1DagUCyO/rYVD/WVgzv26YC8Ed8OIj3Rjby+OgJTGSL1SZKvuIVuIGObCAFHA==';

exports.register = (server, options, next) => {
    reqCacheClient.start((err) => {
        if (err) {
            server.log(['oauth2-catbox-error'], `Error starting Catbox client: ${err}.`);
        }
        server.log(['oauth2-catbox'], `Catbox client successfully started.`);
    });

    server.auth.strategy('auth-session-as', 'cookie', 'required', {
        password: 'password-should-be-32-characters',
        cookie: 'hapi-oauth2-as',
        ttl: 60 * 60 * 1000,
        redirectTo: '/oauth2/login',
        appendNext: true,
        isSecure: false
    });

    server.views({
        engines: { hbs: Handlebars },
        relativeTo: __dirname,
        path: Path.join(__dirname, 'views'),
        layoutPath: Path.join(__dirname, 'views/layout'),
        layout: true,
        isCached: false
    });

    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: Path.join(__dirname, 'public')
            }
        },
        config: {
            auth: false
        }
    });

    server.route({
        method: 'GET',
        path: '/login',
        handler: (request, reply) => {
            const nextUrl = request.query.next;

            if (request.auth.isAuthenticated) {
                console.log('****  /login already authenticated.');
                // return reply.redirect(nextUrl);
            }

            const req_id = TokenUtils.generateToken();
            const key = { id: req_id, segment: 'requests' };
            reqCacheClient.set(key, request.query, 120000, (err) => {
                if (err) {
                    request.log(['oauth2-login-error'], `Error saving login request to cache with key ${req_id}: ${err}.`);
                    return reply(Boom.internal());
                }
                request.log(['oauth2-login'], `Successfully persisted login data to cache with key ${req_id}.`);
                reply.view('login', {
                    req_id: req_id,
                    next: nextUrl,
                    user: request.auth.credentials
                })
            });
        },
        config: {
            auth: {
                strategy:'auth-session-as',
                mode: 'try'
            },
            plugins: {
                'hapi-auth-cookie': {
                    redirectTo: false
                }
            },
            validate: {
                query: {
                    next: Joi.string()
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/login',
        handler: (request, reply) => {

            /*if (request.auth.isAuthenticated) {
                console.log('****  /login already authenticated.');
                return reply.redirect('/ui/home');
            }*/

            const req_id = request.payload.req_id;
            request.log(['oauth2-login'], `Validating login POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let loginReqData;

            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['oauth2-login-error'], `Error retrieving login data from Catbox with key ${req_id}.`);
                } else if (cached) {
                    loginReqData = cached.item;
                    request.log(['oauth2-login'], `Successfully retrieved item from cache with key ${req_id}: ${JSON.stringify(loginReqData)}.`);
                    const {email, password, next} = request.payload;
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['oauth2-login-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['oauth2-login'], `Successfully dropped item from cache with key ${req_id}.`);

                        Models
                            .findUserByEmail(email)
                            .then((user) => {
                                if (!user || user.password !== request.payload.password) {
                                    request.log(['oauth2-login-error'], `Invalid email or password for user ${email}.`);
                                    return reply.redirect('/oauth2/login');
                                } else {
                                    request.log(['oauth2-login'], `Login successful for user ${email}.`);
                                    request.cookieAuth.set({email: user.email, scope: user.role});
                                    if (next) {
                                        return reply.redirect(next);
                                    } else {
                                        return reply.redirect('/oauth2/home');
                                    }
                                }
                            }, (err) => {
                                request.log(['oauth2-login-error'], `Error login in with user ${email}: ${err}.`);
                                return reply.view('error', {
                                    error_message: err.message
                                });
                            });
                    });
                }

                if (!loginReqData) {
                    // No matching req_id, so the form submission is an error or attack
                    const loginRequestNotFound = `No matching login request.`;
                    request.log(['oauth2-login-error'], loginRequestNotFound);
                    return reply.view('error', {
                        error_message: loginRequestNotFound,
                        user: request.auth.credentials
                    });
                }
            });
        },
        config: {
            auth: {
                strategy:'auth-session-as',
                mode: 'try'
            },
            plugins: {
                'hapi-auth-cookie': {
                    redirectTo: false
                }
            },
            validate: {
                payload: {
                    email: Joi.string().email().required(),
                    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
                    req_id: Joi.string().token().max(25).required(),
                    next: Joi.string()
                }
            }
        }
    });

    server.route({
       method: 'GET',
       path: '/logout',
       handler: (request, reply) => {
           request.cookieAuth.clear();
           return reply.redirect('/oauth2/login');
       }
    });

    server.route({
        method: 'GET',
        path: '/authorize',
        handler: (request, reply) => {
            const {client_id, redirect_uri} = request.query;
            request.log(['oauth2-authorize'], `Received request to authorize client ID ${client_id}.`);

            Models
                .findClientById(client_id)
                .then((client) => {
                    if (!Client.isClientValid(client, redirect_uri, client_id, null, null)) {
                        request.log(['oauth2-authorize-error'], `Unknown client ID ${client_id}.`);
                        const urlParsed = buildUrl(redirect_uri, {
                            error: 'invalid_client'
                        });
                        return reply.redirect(urlParsed);
                    }

                    request.log(['oauth2-client'], `Successfully retrieved and validated client ID ${client_id}`);

                    // Optional scopes must be validated
                    const clientScope = client.scope ? client.scope.split(' ') : undefined;
                    const requestScope = request.query.scope ? request.query.scope.split(' ') : undefined;

                    if (!OAuthUtils.isScopeValid(requestScope, clientScope)) {
                        request.log(['oauth-authorize-error'], `Authorize request contains invalid scope.`);
                        const urlParsed = buildUrl(redirect_uri, {
                            error: 'invalid_scope'
                        });
                        return reply.redirect(urlParsed);
                    }

                    const req_id = TokenUtils.generateToken();
                    const key = { id: req_id, segment: 'requests' };
                    reqCacheClient.set(key, request.query, 120000, (err) => {
                        if (err) {
                            request.log(['oauth2-authorize-error'], `Error saving authorization request to cache with key ${req_id}: ${err}.`);
                            return reply(Boom.internal());
                        }
                        request.log(['oauth2-authorize'], `Successfully persisted authorization data to cache with key ${req_id}.`);
                        reply.view('authorize', {
                            client: requestScope ? Object.assign({}, client, {scope: requestScope}) : client,
                            redirect_uri: redirect_uri,
                            req_id: req_id,
                            user: request.auth.credentials
                        });
                    });
                }, (err) => {
                    request.log(['oauth2-client-error'], `Error retrieving client ID ${client_id}: ${err}.`);
                    return reply.view('error', {
                        error_message: err.message,
                        user: request.auth.credentials
                    });
                });
        },
        config: {
            validate: {
                query: {
                    client_id: Joi.string().max(50).required(),
                    redirect_uri: Joi.string().uri().required(),
                    response_type: Joi.any().allow('code'),
                    scope: Joi.string().allow('').optional(),
                    state: Joi.string().token().allow('')
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/approve',
        handler: (request, reply) => {
            // Performing validation here, since scope is submitted by client:
            // i.e.: request.payload will contain zero or more scopes,
            // as approved by the Resource Owner
            const reqIdSchema = Joi.string().token().max(25);
            const decisionSchema = Joi.string().allow(['approve', 'deny']);
            const {req_id, decision} = request.payload;

            try {
                Joi.assert(req_id, reqIdSchema);
            } catch (err) {
                return reply(Boom.badRequest('Missing req_id token.'))
            }
            try {
                Joi.assert(decision, decisionSchema);
            } catch (err) {
                return reply(Boom.badRequest('Decision must be either \`approve\` or \`deny\`.'))
            }

            request.log(['oauth2-approve'], `Validating approval POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['oauth2-approve-error'], `Error retrieving authorization data from Catbox with key ${req_id}.`);
                    return reply(Boom.internal());
                } else if (!cached) {
                    const authRequestNotFound = `No matching authorization request.`;
                    request.log(['oauth2-approve-error'], authRequestNotFound);
                    return reply(Boom.badRequest(authRequestNotFound));
                }

                let authReqData = cached.item;
                request.log(['oauth2-approve'], `Successfully retrieved item from cache with key ${req_id}: ${authReqData}.`);
                // TODO: verify remaining TTL is less than two minutes
                reqCacheClient.drop(key, (err) => {
                    if (err) {
                        request.log(['oauth2-approve-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                    }
                    request.log(['oauth2-approve'], `Successfully dropped item from cache with key ${req_id}.`);

                    if (decision === 'deny') {
                        request.log(['oauth2-approve-error'], `Owner denied client access.`);
                        const urlParsed = buildUrl(authReqData.redirect_uri, {
                            error: 'access_denied'
                        });
                        reply.redirect(urlParsed);
                    }

                    request.log(['oauth2-approve'], `Owner approved client access. Verifying scope.`);
                    // What scope did the Resource Owner approved the client for?
                    const requestScope = authReqData.scope ? authReqData.scope.split(' ') : undefined;
                    const approvedScope = OAuthUtils.determineScope(requestScope, request.payload);

                    if (authReqData.response_type === 'code') {
                        request.log(['oauth2-approve'], `Processing grant type: authorization code.`);
                        const code = TokenUtils.generateToken();
                        delete authReqData.response_type;
                        let ttl = new Date();
                        ttl.setDate(ttl.getDate() + 1);

                        Models
                            .saveCode(Object.assign({}, authReqData, {code: code, ttl: ttl, scope: approvedScope}))
                            .then((code) => {
                                request.log(['oauth2-code'], `Generated and persisted code ${code}.`);
                                const urlParsed = buildUrl(authReqData.redirect_uri, {
                                    code: code.code,
                                    state: authReqData.state
                                });
                                reply.redirect(urlParsed);
                            }, (err) => {
                                request.log(['oauth2-code-error'], `Error saving code ${code}: ${err}.`);
                                const urlParsed = buildUrl(authReqData.redirect_uri, {
                                    error: 'error_generating_code'
                                });
                                reply.redirect(urlParsed);
                            });

                    } else {
                        request.log(['oauth2-approve-error'], `Request type not supported: ${authReqData.response_type}.`);
                        const urlParsed = buildUrl(authReqData.redirect_uri, {
                            error: 'unsupported_response_type'
                        });
                        reply.redirect(urlParsed);
                    }
                });
            });
        }
    });

    server.route({
        method: 'POST',
        path: '/token',
        handler: (request, reply) => {
            // TODO: support other auth methods than HTTP Basic
            // For example, private_key_jwt, etc....
            // Methods will be defined during dynamic client registration
            let clientId, clientSecret;
            const authHeader = request.raw.req.headers["authorization"];

            // Check authorization header
            if (authHeader) {
                request.log(['oauth2-token'], `Found authorization header for client credentials.`);
                const clientCredentials = decodeClientCredentials(authHeader);
                clientId = clientCredentials.id;
                clientSecret = clientCredentials.secret;
                request.log(['oauth2-token'], `Extracted client ID from authorization header: ${clientId}.`)
            }

            // Check POST body
            if (request.payload.client_id) {
                request.log(['oauth2-token'], `Found POST body for client credentials.`);
                if (clientId) {
                    // Client already authenticated
                    const dupClientCredentialsMsg = `Client attempted to authenticate with multiple methods.`;
                    request.log(['oauth2-token-error'], dupClientCredentialsMsg);
                    reply(Boom.unauthorized(`invalid_client`));
                }
                clientId = request.payload.client_id;
                clientSecret = request.payload.client_secret;
            }

            const grant_type = request.payload.grant_type;

            Models
                .findClientById(clientId)
                .then((client) => {
                    if (!Client.isClientValid(client, null, clientId, clientSecret, grant_type)) {
                        request.log(['oauth2-token-error'], `Invalid client ID ${clientId}.`);
                        return reply(Boom.unauthorized(`invalid_client`));
                    }

                    const clientScope = client.scope ? client.scope.split(' ') : undefined;
                    const reqScope = request.payload.scope ? request.payload.scope.split(' ') : undefined;
                    if (!OAuthUtils.isScopeValid(reqScope, clientScope)) {
                        request.log(['oauth-token-error'], `Token request contains invalid scope.`);
                        return reply(Boom.unauthorized(`invalid_scope`));
                    }

                    if (grant_type === 'authorization_code') {
                        const code = request.payload.code;
                        Models
                            .findCodeByValue(code)
                            .then(code => {
                                if (!code) {
                                    request.log(['oauth2-token-error'], `Unknown code ${code}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }
                                // Found the code, ready to issue the token
                                request.log(['oauth2-token'], `Found matching code ${code.value}.`);
                                const today = new Date();
                                if (code.ttl < today) {
                                    request.log(['oauth2-token-error'], `Code expired on ${code.ttl}.`);
                                    return reply(Boom.unauthorized('code_expired'));
                                } else if (code.client_id === clientId) {

                                    // JSON Web Token
                                    const header = {typ: 'JWT', alg: 'HS256'};
                                    const payload = {
                                        iss: 'http://localhost:9007/',
                                        sub: code.client_id,
                                        aud: 'http://localhost:8080/',
                                        iat: Math.floor(Date.now() / 1000),
                                        exp: Math.floor(Date.now() / 1000) + (5 * 60),
                                        jti: TokenUtils.generateToken()
                                    };
                                    // Unsigned token -- unsafe
                                    // const access_token = `${Base64url.encode(JSON.stringify(header))}.${Base64url.encode(JSON.stringify(payload))}.`;
                                    // Randomized Token -- makes the previous one look safe
                                    // const access_token = Randomstring.generate(25);

                                    const access_token = Jose.jws.JWS.sign(header.alg,
                                        JSON.stringify(header),
                                        JSON.stringify(payload),
                                        new Buffer(sharedTokenSecret).toString('hex'));

                                    request.log(['oauth2-token'], `Issuing token: ${access_token}.`);

                                    const refresh_token = TokenUtils.generateToken();
                                    const token_response = {
                                        access_token: access_token,
                                        token_type: 'Bearer',
                                        state: code.state,
                                        refresh_token: refresh_token
                                    };
                                    // TODO: check that scope matches what the client is allowed
                                    if (code.scope) {
                                        token_response.scope = code.scope;
                                    }
                                    let ttl = new Date();
                                    ttl.setDate(ttl.getDate() + 1);

                                    Models
                                        .deleteTokenByClientId(clientId)
                                        .then((result) => {
                                            request.log(['oauth2-token'], `Deleted existing token: ${result}.`);
                                            Models
                                                .saveToken(Object.assign({}, token_response, {client_id: clientId, ttl: ttl}))
                                                .then((token) => {
                                                    request.log(['oauth2-token'], `Successfully persisted token ${token_response}. Sending it to client.`);
                                                    Models
                                                        .deleteCode(code._id)
                                                        .then((code) => {
                                                            request.log(['oauth2-token'], `Successfully deleted code ${code.code}.`);
                                                            return reply(token_response);
                                                        }, (err) => {
                                                            request.log(['oauth2-token-error'], `Error deleting code ${code.code}: ${err}.`);
                                                            return reply(Boom.internal());
                                                        });
                                                }, (err) => {
                                                    request.log(['oauth2-token-error'], `Error persisting token ${access_token}: ${err}.`);
                                                    return reply(Boom.internal());
                                                });
                                        }, (err) => {
                                            request.log(['oauth2-token-error'], `Error looking up existing token for client ID ${clientId}: ${err}.`);
                                            return reply(Boom.internal());
                                        });

                                } else {
                                    request.log(['oauth2-token-error'], `Client mismatch, expected ${code.client_id} got ${clientId}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }

                            }, (err) => {
                                request.log(['oauth2-token-error'], `Error retrieving code ${code}: ${err}.`);
                                return reply(Boom.internal());
                            });

                    } else if (grant_type === 'client_credentials') {
                        //TODO: implement checks for client_credentials grant type
                        // Does the client have a token? IF yes, revoke it

                    } else if (grant_type === 'refresh_token') {
                        const refresh_token = request.payload.refresh_token;
                        Models
                            .findTokenByRefresh(refresh_token)
                            .then((token) => {
                                if (!token) {
                                    request.log(['oauth2-token-error'], `No matching refresh token ${refresh_token}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }
                                request.log(['oauth2-token'], `Found matching refresh token ${refresh_token}.`);
                                if (clientId !== token.client_id) {
                                    request.log(['oauth2-token-error'], `Mismatched client ID ${clientId}. Deleting the token for security reasons.`);
                                    Models
                                        .deleteToken(token._id)
                                        .then((result) => {
                                            request.log(['oauth2-token'], `Successfully deleting token ${token.access_token}: ${result}.`);
                                            return reply(Boom.unauthorized('invalid_grant'));
                                        }, (err) => {
                                            request.log(['oauth2-token-error'], `Error deleting token ${token.access_token}: ${err}.`);
                                            return reply(Boom.internal());
                                        });
                                }
                                request.log(['oauth2-token'], `Refreshing token ${token.access_token}.`);
                                const access_token = TokenUtils.generateToken();
                                token.access_token = access_token;
                                let ttl = new Date();
                                ttl.setDate(ttl.getDate() + 1);
                                token.ttl = ttl;
                                Models
                                    .saveToken(token)
                                    .then((token) => {
                                        const token_response = { access_token: access_token, token_type: 'Bearer', state: token.state, refresh_token: token.refresh_token };
                                        if (token.scope) {
                                            token_response.scope = token.scope;
                                        }
                                        return reply(token_response);
                                    }, (err) => {
                                        request.log(['oauth2-token-error'], `Error persisting new access token ${token.access_token}: ${err}.`);
                                        return reply(Boom.internal());
                                    });
                            }, (err) => {
                                console.log(err);
                            })

                    } else {
                        // TODO: support other grant types
                        request.log(['oauth2-token-error'], `Unknown grant type ${grant_type}.`);
                        reply(Boom.badRequest('invalid_grant'));
                    }
                }, (err) => {
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            auth: false,
            /*validate: {
                payload: {
                    grant_type: Joi.string().allow(['authorization_code', 'client_credentials', 'refresh_token']),
                    scope: Joi.string().allow('').optional(),
                    state: Joi.string().token().allow(''),
                    redirect_uri: Joi.string().uri().optional()
                }
            }*/
        }
    });



    next();
};

const decodeClientCredentials = function(auth) {
    const clientCredentials = new Buffer(auth.slice('basic '.length), 'base64').toString().split(':');
    const clientId = querystring.unescape(clientCredentials[0]);
    const clientSecret = querystring.unescape(clientCredentials[1]);
    return { id: clientId, secret: clientSecret };
};

const buildUrl = function(base, options, hash) {
    const newUrl = URL.parse(base, true);
    delete newUrl.search;
    if (!newUrl.query) {
        newUrl.query = {};
    }

    Object.entries(options).forEach(([key, value]) => {
        newUrl.query[key] = value;
    });

    if (hash) {
        newUrl.hash = hash;
    }

    return URL.format(newUrl);
};

exports.register.attributes = {
    pkg: meta,
};



