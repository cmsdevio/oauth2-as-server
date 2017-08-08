const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Mongoose = require('mongoose');
const Randomstring = require('randomstring');
const Crypto = require('crypto');
const Base64url = require('base64url');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const Jose = require('jsrsasign');
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
            // Fallback to using memory
            server.log(['oauth2-catbox-error'], `Error starting Catbox client: ${err}.`);
        }
        server.log(['oauth2-catbox'], `Catbox client successfully started.`);
    });

    server.auth.strategy('simple', 'bearer-access-token', 'required', {
        validateFunc: function (token, callback) {
            const key = { id: token, segment: 'requests' };
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    server.log(['oauth2-bearer-error'], `Error retrieving token ${token} from Catbox.`);
                    return callback(null, false, { token: token });
                } else if (cached) {
                    server.log(['oauth2-bearer'], `Successfully retrieved token ${token} from cache.`);
                    return callback(null, true, { token: token, user: cached.item, scope: cached.item.role });
                } else {
                    server.log(['oauth2-bearer'], `Mis-matched token ${token}.`);
                    return callback(null, false, { token: token });
                }
            });
        }
    });

    server.route({
        method: 'GET',
        path: '/users',
        handler: (request, reply) => {
            Models
                .findUsers()
                .then((users) => {
                    reply({users: users});
                }, (err) => {
                    request.log(['oauth2-users-error'], `Error retrieving users: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/user',
        handler: (request, reply) => {
            const {email} = request.payload;
            Models
                .findUserByEmail(email)
                .then((user) => {
                    if (!user) {
                        Models
                            .saveUser(Object.assign({}, request.payload, {role: 'user', active: true}))
                            .then((user) => {
                                request.log(['oauth2-user'], `Successfully created user: ${user}.`);
                                return reply({user: user});
                            }, (err) => {
                                request.log(['oauth2-user-error'], `Error creating user: ${err}.`);
                                return reply(Boom.internal(`Error creating new user.`));
                            });
                    } else {
                        request.log(['oauth2-user-error'], `User already exists: ${email}.`);
                        // TODO: should be HTTP 400
                        reply(Boom.badData('User already exists.'))
                    }
                }, (err) => {
                    request.log(['oauth2-user-error'], `Error checking if user ${email} exists: ${err}.`);
                    reply(Boom.internal());
                });
        },
        config: {
            validate: {
                payload: {
                    email: Joi.string().email().required(),
                    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required()
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/login',
        handler: (request, reply) => {
            const {email} = request.payload;
            Models
                .findUserByEmail(email)
                .then((user) => {
                    if (!user || user.password !== request.payload.password) {
                        request.log(['oauth2-login-error'], `Invalid email or password for user ${email}.`);
                        return reply(Boom.unauthorized('Invalid email or password.'));
                    } else {
                        request.log(['oauth2-login'], `Login successful for user ${email}.`);
                        // TODO: parameterize size
                        // TODO: send hash instead
                        const token = Base64url(Crypto.randomBytes(20));
                        const key = { id: token, segment: 'requests' };
                        reqCacheClient.set(key, user, 60 * 60 * 1000, (err) => {
                            if (err) {
                                request.log(['oauth2-login-error'], `Error saving token to cache with key ${token}: ${err}.`);
                            }
                            request.log(['oauth2-login'], `Successfully persisted token ${token} to cache.`);
                            return reply({token: token, email: user.email, scope: user.role});
                        });

                    }
                }, (err) => {
                    request.log(['oauth2-login-error'], `Error login in with user ${email}: ${err}.`);
                    reply(Boom.internal());
                });
        },
        config: {
            auth: false,
            validate: {
                payload: {
                    email: Joi.string().email().required(),
                    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required()
                }
            }
        }
    });

    server.route({
       method: 'GET',
       path: '/logout',
       handler: (request, reply) => {
           const token = request.auth.credentials.token;
           const key = {id: token, segment: 'requests'};
           reqCacheClient.drop(key, (err) => {
               if (err) {
                   request.log(['oauth2-logout-error'], `Error deleting token ${token}: ${err}.`);
                   return reply(Boom.internal());
               }
               request.log(['oauth2-logout'], `Successfully deleted token ${token}.`);
               return reply({success: true});
           });
       }
    });

    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            Models
                .findClients()
                .then((clients) => {
                    reply({clients: clients});
                }, (err) => {
                    request.log(['oauth2-clients-error'], `Error retrieving clients: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/client',
        handler: (request, reply) => {
            const {client_id} = request.payload;
            Models
                .findClientById(client_id)
                .then((client) => {
                    if (!client) {
                        const client_data = Object.assign({}, request.payload, {active: true});

                        Models
                            .saveClient(client_data)
                            .then((client) => {
                                request.log(['oauth2-client'], `Successfully created client: ${client}.`);
                                return reply({client: client});
                            }, (err) => {
                                request.log(['oauth2-client-error'], `Error creating client: ${err}.`);
                                return reply(Boom.internal(`Error creating new client.`));
                            });
                    } else {
                        request.log(['oauth2-client-error'], `Client already exists: ${client_id}.`);
                        // TODO: should be HTTP 400
                        reply(Boom.badData('Client already exists.'))
                    }
                }, (err) => {
                    request.log(['oauth2-client-error'], `Error checking if client ${client_id} exists: ${err}.`);
                    reply(Boom.internal());
                });
        },
        config: {
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{3,30}$/).required(),
                    client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{3,30}$/).required(),
                    scope: Joi.string().optional(),
                    redirect_uris: Joi.array().items(Joi.string().uri())
                }
            }
        }
    });

    server.route({
        method: 'DELETE',
        path: '/client',
        handler: (request, reply) => {
            const {client_id} = request.payload;
            Models
                .deleteClient(client_id, request.auth.credentials.user_id)
                .then((client) => {
                    if (!client) {
                        request.log(['oauth2-client-error'], `Client ${client_id} doesn't exist.`);
                        // TODO: should be HTTP 400
                        return reply(Boom.badData('Client doesn\'t exist.'));
                    } else {
                        return reply({success: true});
                    }
                }, (err) => {
                    request.log(['oauth2-client-error'], `Error checking if client ${client_id} exists: ${err}.`);
                    reply(Boom.internal());
                });
        },
        config: {
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{3,30}$/).required(),
                }
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/client',
        handler: (request, reply) => {
            const clientId = request.query.client_id;
            request.log(['oauth2-client'], `Retrieving client ID ${clientId}`);
            Models
                .findClientById(clientId, request.auth.credentials.user_id)
                .then((client) => {
                    if (!client) {
                        request.log(['oauth2-client-error'], `Unknown client ID ${clientId}.`);
                        reply({client: null});
                    } else if (!client.active) {
                        request.log(['oauth2-client-error'], `Client ID ${clientId} is inactive.`);
                        reply(Boom.unauthorized(`Client is not active.`));
                    } else {
                        request.log(['oauth2-client'], `Successfully retrieved client ID ${clientId}`);
                        reply({client: client});
                    }
                }, (err) => {
                    request.log(['oauth2-client-error'], `Error retrieving client ID ${clientId}: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            validate: {
                query: {
                    client_id: Joi.string().max(250).required()
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/code',
        handler: (request, reply) => {
            const {code} = request.payload;
            let ttl = new Date();
            ttl.setDate(ttl.getDate() + 1);

            Models
                .saveCode(Object.assign({}, request.payload, {ttl: ttl}))
                .then((code) => {
                    request.log(['oauth2-code'], `Saved code ${code}.`);
                    reply({code: code});
                }, (err) => {
                    request.log(['oauth2-code-error'], `Error saving code ${code}: ${err}.`);
                    reply(Boom.internal(`Error saving code.`));
                });
        },
        // TODO: size of token, client_id should be parameterized
        config: {
            validate: {
                payload: {
                    code: Joi.string().token().max(15).required(),
                    client_id: Joi.string().max(50).required(),
                    redirect_uri: Joi.string().uri().required(),
                    scope: Joi.string().allow(''),
                    state: Joi.string().token().allow('')
                }
            }
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

exports.register.attributes = {
    pkg: meta,
};



