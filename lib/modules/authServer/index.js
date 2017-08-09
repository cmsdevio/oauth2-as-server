const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Path = require('path');
const Mongoose = require('mongoose');
const Randomstring = require('randomstring');
const Handlebars = require('handlebars');
const Crypto = require('crypto');
const Base64url = require('base64url');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const URL = require('url');
const Jose = require('jsrsasign');
const _ = require('lodash');
const querystring = require('querystring');
const Models = require('./persistence/mongodb/models');

Mongoose.Promise = require('bluebird');
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

            const req_id = Randomstring.generate(12);
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
                    req_id: Joi.string().token().max(12).required(),
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
                    if (!client) {
                        request.log(['oauth2-client-error'], `Unknown client ID ${client_id}.`);
                        const urlParsed = buildUrl(request.query.redirect_uri, {
                            error: 'invalid_client'
                        });
                        return reply.redirect(urlParsed);
                    } else if (!client.active) {
                        request.log(['oauth2-client-error'], `Client ID ${client_id} is inactive.`);
                        const urlParsed = buildUrl(request.query.redirect_uri, {
                            error: 'invalid_client'
                        });
                        return reply.redirect(urlParsed);
                    } else if (client.redirect_uris.indexOf(redirect_uri) === -1) {
                        request.log(['oauth2-authorize-error'], `Invalid redirect URI ${redirect_uri}.`);
                        const urlParsed = buildUrl(request.query.redirect_uri, {
                            error: 'invalid_client'
                        });
                        return reply.redirect(urlParsed);
                    } else {
                        request.log(['oauth2-client'], `Successfully retrieved client ID ${client_id}`);
                        const clientScope = client.scope ? client.scope.split(' ') : undefined;
                        const requestScope = request.query.scope ? request.query.scope.split(' ') : undefined;
                        if (_.difference(requestScope, clientScope).length > 0) {
                            request.log(['oauth-authorize-error'], `Authorize request contains invalid scope.`);
                            const urlParsed = buildUrl(request.query.redirect_uri, {
                                error: 'invalid_scope'
                            });
                            return reply.redirect(urlParsed);
                        }

                        if (requestScope) {
                            client.scope = requestScope;
                        }

                        const req_id = Randomstring.generate(12);
                        const key = { id: req_id, segment: 'requests' };
                        reqCacheClient.set(key, request.query, 120000, (err) => {
                            if (err) {
                                request.log(['oauth2-authorize-error'], `Error saving authorization request to cache with key ${req_id}: ${err}.`);
                                return reply(Boom.internal());
                            }
                            request.log(['oauth2-authorize'], `Successfully persisted authorization data to cache with key ${req_id}.`);
                            reply.view('authorize', {
                                client: client,
                                redirect_uri: redirect_uri,
                                req_id: req_id,
                                user: request.auth.credentials
                            });
                        });
                    }
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
            // Performing validation here, since scope is submitted by client
            const reqIdSchema = Joi.string().token().max(12);
            const decisionSchema = Joi.string().allow(['approve', 'deny']);
            const req_id = request.payload.req_id;
            const decision = request.payload.decision;
            try {
                if (!req_id) throw new Error();
                Joi.assert(req_id, reqIdSchema);
            } catch (err) {
                return reply(Boom.badRequest('req_id must be a token, with length 12'))
            }
            try {
                if (!decision) throw new Error();
                Joi.assert(decision, decisionSchema);
            } catch (err) {
                return reply(Boom.badRequest('decision must be either \`approve\` or \`deny\`'))
            }

            request.log(['oauth2-approve'], `Validating approval POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let query;
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['oauth2-approve-error'], `Error retrieving authorization data from Catbox with key ${req_id}.`);
                    return reply(Boom.internal());
                } else if (cached) {
                    const reqData = cached.item;
                    request.log(['oauth2-approve'], `Successfully retrieved item from cache with key ${req_id}: ${reqData}.`);
                    // TODO: verify remaining TTL is less than two minutes
                    query = reqData;
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['oauth2-approve-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['oauth2-approve'], `Successfully dropped item from cache with key ${req_id}.`);

                        if (decision === 'approve') {
                            request.log(['oauth2-approve'], `Owner approved client access. Verifying scope.`);
                            // What scope did the Resource Owner approved the client for?
                            const requestScope = query.scope ? query.scope.split(' ') : undefined;
                            const approvedScope = [];
                            if (requestScope) {
                                request.log(['oauth2-approve'], `Validating which scope was granted by the resource owner. Client sent: ${requestScope}.`);
                                requestScope.forEach((aScope) => {
                                    if (request.payload[aScope]) {
                                        approvedScope.push(aScope);
                                    }
                                });
                                request.log(['oauth2-approve'], `Resource owner gave scope: ${approvedScope}.`);
                            }

                            if (query.response_type === 'code') {
                                request.log(['oauth2-approve'], `Processing grant type: authorization code.`);
                                const code = Randomstring.generate(15);

                                // TODO: persist code in Mongodb with ref to client
                                delete query.response_type;
                                if (requestScope) {
                                    query.scope = approvedScope.join(' ');
                                }
                                let ttl = new Date();
                                ttl.setDate(ttl.getDate() + 1);

                                Models
                                    .saveCode(Object.assign({}, query, {code: code, ttl: ttl}))
                                    .then((code) => {
                                        request.log(['oauth2-code'], `Generated and persisted code ${code}.`);
                                        const urlParsed = buildUrl(query.redirect_uri, {
                                            code: code,
                                            state: query.state
                                        });
                                        reply.redirect(urlParsed);
                                    }, (err) => {
                                        request.log(['oauth2-code-error'], `Error saving code ${code}: ${err}.`);
                                        const urlParsed = buildUrl(query.redirect_uri, {
                                            error: 'error_generating_code'
                                        });
                                        reply.redirect(urlParsed);
                                    });

                            } else {
                                request.log(['oauth2-approve-error'], `Request type not supported yet: ${query.response_type}.`);
                                const urlParsed = buildUrl(query.redirect_uri, {
                                    error: 'unsupported_response_type'
                                });
                                reply.redirect(urlParsed);
                            }
                        } else {
                            request.log(['oauth2-approve-error'], `Owner denied client access.`);
                            const urlParsed = buildUrl(query.redirect_uri, {
                                error: 'access_denied'
                            });
                            reply.redirect(urlParsed);
                        }
                    })
                }

                if (!query) {
                    // No matching req_id, so the form submission is an error or attack
                    const authRequestNotFound = `No matching authorization request.`;
                    request.log(['oauth2-approve-error'], authRequestNotFound);
                    reply.view('error', {
                        error_message: authRequestNotFound,
                        user: request.auth.credentials
                    });
                }
            });
        }
    });

    server.route({
        method: 'POST',
        path: '/token',
        handler: (request, reply) => {
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

            Models
                .findClientById(clientId)
                .then((client) => {
                    if (!client) {
                        request.log(['oauth2-token-error'], `Unknown client ID ${clientId}.`);

                        reply(Boom.unauthorized('invalid_client'));
                        return;
                    } else if (!client.active) {
                        request.log(['oauth2-token-error'], `Client ID ${clientId} is inactive.`);
                        reply(Boom.unauthorized(`invalid_client`));
                    }

                    // TODO: use appropriate crypto method
                    if (client.client_secret !== clientSecret) {
                        request.log(['oauth2-token-error'], `Invalid client secret for ID ${clientId}.`);
                        reply(Boom.unauthorized('invalid_client'));
                        return;
                    }

                    const grant_type = request.payload.grant_type;
                    if (grant_type === 'authorization_code') {
                        const code = request.payload.code;
                        Models
                            .findCodeByValue(code)
                            .then((code) => {
                                if (!code) {
                                    request.log(['oauth2-token-error'], `Unknown code ${code}.`);
                                    reply(Boom.unauthorized('invalid_grant'));
                                    return;
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
                                        jti: Randomstring.generate(25)
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

                                    const refresh_token = Randomstring.generate(25);
                                    const token_response = {
                                        access_token: access_token,
                                        token_type: 'Bearer',
                                        state: code.state,
                                        refresh_token: refresh_token
                                    };
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
                                const access_token = Randomstring.generate(25);
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
            auth: false
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



