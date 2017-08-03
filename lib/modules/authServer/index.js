const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Mongoose = require('mongoose');
const Randomstring = require('randomstring');
const Crypto = require('crypto');
const Base64url = require('base64url');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const ClientPersistence = require('./persistence/clients/clientsMongoose');
const CodePersistence = require('./persistence/codes/codesMongoose');
const UserPersistence = require('./persistence/users/usersMongoose');
const TokenPersistence = require('./persistence/tokens/tokensMongoose');

const querystring = require('querystring');
const Client = new ClientPersistence();
const Code = new CodePersistence();
const User = new UserPersistence();
const Token = new TokenPersistence();

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

exports.register = (server, options, next) => {
    reqCacheClient.start((err) => {
        if (err) {
            // Fallback to using memory
            server.log(['oauth2-catbox-error'], `Error starting Catbox client: ${err}.`);
        }
        server.log(['oauth2-catbox'], `Catbox client successfully started.`);
    });

    server.auth.strategy('simple', 'bearer-access-token', {
        validateFunc: function (token, callback) {
            const key = { id: token, segment: 'requests' };
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    server.log(['oauth2-bearer-error'], `Error retrieving token ${token} from Catbox.`);
                    return callback(null, false, { token: token });
                } else if (cached) {
                    server.log(['oauth2-bearer'], `Successfully retrieved token ${token} from cache.`);
                    return callback(null, true, { token: token, user_id: cached.item });
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
            User
                .find()
                .then((users) => {
                    reply({users: users});
                }, (err) => {
                    request.log(['oauth2-users-error'], `Error retrieving users: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            auth: 'simple'
        }
    });

    server.route({
        method: 'POST',
        path: '/user',
        handler: (request, reply) => {
            const userEmail = request.payload.email;
            User
                .findByEmail(userEmail)
                .then((user) => {
                    if (!user) {
                        let newUser = User.create(Object.assign({}, request.payload, {role: 'user', active: true}));
                        // Save the object
                        newUser
                            .save((err, user) => {
                                if (err) {
                                    request.log(['oauth2-user-error'], `Error creating user: ${err}.`);
                                    return reply(Boom.internal(`Error creating new user.`));
                                }
                                request.log(['oauth2-user'], `Successfully created user: ${user}.`);
                                return reply({user: user});
                            });
                    } else {
                        request.log(['oauth2-user-error'], `User already exists: ${userEmail}.`);
                        // TODO: should be HTTP 400
                        reply(Boom.badData('User already exists.'))
                    }
                }, (err) => {
                    request.log(['oauth2-user-error'], `Error checking if user ${userEmail} exists: ${err}.`);
                    reply(Boom.internal());
                });



        },
        config: {
            auth: 'simple',
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
            const userEmail = request.payload.email;
            User
                .findByEmail(userEmail)
                .then((user) => {
                    if (!user || user.password !== request.payload.password) {
                        request.log(['oauth2-login-error'], `Invalid email or password for user ${userEmail}.`);
                        return reply(Boom.unauthorized('Invalid email or password.'));
                    } else {
                        request.log(['oauth2-login'], `Login successful for user ${userEmail}.`);
                        // TODO: parameterize size
                        // TODO: send hash instead
                        const token = Base64url(Crypto.randomBytes(20));
                        const key = { id: token, segment: 'requests' };
                        reqCacheClient.set(key, user._id, 60 * 60 * 1000, (err) => {
                            if (err) {
                                request.log(['oauth2-login-error'], `Error saving token to cache with key ${token}: ${err}.`);
                            }
                            request.log(['oauth2-login'], `Successfully persisted token ${token} to cache.`);
                            return reply({token: token, email: user.email});
                        });

                    }
                }, (err) => {
                    request.log(['oauth2-login-error'], `Error login in with user ${userEmail}: ${err}.`);
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
        path: '/clients',
        handler: (request, reply) => {
            Client
                .findByUserId(request.auth.credentials.user_id)
                .then((clients) => {
                    reply({clients: clients});
                }, (err) => {
                    request.log(['oauth2-clients-error'], `Error retrieving clients: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        },
        config: {
            auth: 'simple'
        }
    });

    server.route({
        method: 'POST',
        path: '/client',
        handler: (request, reply) => {
            const {clientId} = request.payload;
            Client
                .findByClientAndUserId(clientId, request.auth.credentials.user_id)
                .then((client) => {
                    if (!client) {
                        const clientData = Object.assign({}, request.payload, {
                            user_id: request.auth.credentials.user_id,
                            active: true
                        });
                        let newClient = Client.create(clientData);
                        // Save the object
                        newClient
                            .save((err, client) => {
                                if (err) {
                                    request.log(['oauth2-client-error'], `Error creating client: ${err}.`);
                                    return reply(Boom.internal(`Error creating new client.`));
                                }
                                request.log(['oauth2-client'], `Successfully created client: ${client}.`);
                                return reply({client: client});
                            });
                    } else {
                        request.log(['oauth2-client-error'], `Client already exists: ${clientId}.`);
                        // TODO: should be HTTP 400
                        reply(Boom.badData('Client already exists.'))
                    }
                }, (err) => {
                    request.log(['oauth2-client-error'], `Error checking if client ${clientId} exists: ${err}.`);
                    reply(Boom.internal());
                });
        },
        config: {
            auth: 'simple',
            validate: {
                payload: {
                    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{3,30}$/).required(),
                    client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{3,30}$/).required(),
                    redirect_uris: Joi.any(),
                }
            }
        }
    });

    server.route({
        method: 'DELETE',
        path: '/client',
        handler: (request, reply) => {
            const {client_id} = request.payload;
            Client
                .delete(client_id, request.auth.credentials.user_id)
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
            auth: 'simple',
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
            Client
                .findByClientId(clientId, request.auth.credentials.user_id)
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
            auth: 'simple',
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
            const {value, client_id} = request.payload;
            let ttl = new Date();
            ttl.setDate(ttl.getDate() + 1);

            // Delete any code for that client_id
            // None should exist.
            Code
                .delete(client_id)
                .then((result) => {
                    request.log(['oauth2-code-error'], `Codes deleted: ${result}.`);
                    let newCode = Code.create(Object.assign({}, request.payload, {ttl: ttl}));
                    newCode
                        .save()
                        .then((code) => {
                            request.log(['oauth2-code'], `Saved code ${code.value}.`);
                            reply({code: code});
                        }, (err) => {
                            request.log(['oauth2-code-error'], `Error saving code ${value}: ${err}.`);
                            reply(Boom.internal(`Error saving code.`));
                        });
                }, (err) => {
                    request.log(['oauth2-code-error'], `Error deleting codes by client_id ${client_id}: ${err}.`);
                    return reply(Boom.internal());
                });
        },
        // TODO: size of token, client_id should be parameterized
        config: {
            auth: 'simple',
            validate: {
                payload: {
                    value: Joi.string().token().max(15).required(),
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

            Client
                .findByClientId(clientId)
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
                        Code
                            .findAndDelete(code)
                            .then((data) => {
                                if (!data) {
                                    request.log(['oauth2-token-error'], `Unknown code ${code}.`);
                                    reply(Boom.unauthorized('invalid_grant'));
                                    return;
                                }
                                // Found the code, ready to issue the token
                                request.log(['oauth2-token'], `Found matching code ${data.value}.`);
                                const today = new Date();
                                if (data.ttl < today) {
                                    request.log(['oauth2-token-error'], `Code expired on ${data.ttl}.`);
                                    return reply(Boom.unauthorized('code_expired'));
                                } else if (data.client_id === clientId) {
                                    const access_token = Randomstring.generate(25);
                                    const refresh_token = Randomstring.generate(25);
                                    const token_response = { access_token: access_token, token_type: 'Bearer', state: data.state, refresh_token: refresh_token };
                                    let ttl = new Date();
                                    ttl.setDate(ttl.getDate() + 1);
                                    let newToken = Token.create(Object.assign({}, token_response, {client_id: clientId, ttl: ttl}));
                                    Token
                                        .findByClientIdAndDelete(clientId)
                                        .then((result) => {
                                            request.log(['oauth2-token'], `Deleted existing token: ${result}.`);
                                            newToken
                                                .save()
                                                .then((token) => {
                                                    request.log(['oauth2-token'], `Successfully persisted token ${token_response}. Sending it to client.`);
                                                    return reply(token_response);
                                                }, (err) => {
                                                    request.log(['oauth2-token-error'], `Error persisting token ${access_token}: ${err}.`);
                                                    return reply(Boom.internal());
                                                });
                                        }, (err) => {
                                            request.log(['oauth2-token-error'], `Error looking up existing token for client ID ${clientId}: ${err}.`);
                                            return reply(Boom.internal());
                                        });

                                } else {
                                    request.log(['oauth2-token-error'], `Client mismatch, expected ${data.client_id} got ${clientId}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }

                            }, (err) => {
                                request.log(['oauth2-token-error'], `Error retrieving code ${code}: ${err}.`);
                                return reply(Boom.internal());
                            });

                    } else if (grant_type === 'refresh_token') {
                        const refresh_token = request.payload.refresh_token;
                        Token
                            .findByRefreshToken(refresh_token)
                            .then((token) => {
                                if (!token) {
                                    request.log(['oauth2-token-error'], `No matching refresh token ${refresh_token}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }
                                request.log(['oauth2-token'], `Found matching refresh token ${refresh_token}.`);
                                if (clientId !== token.client_id) {
                                    request.log(['oauth2-token-error'], `Mismatched client ID ${clientId}. Deleting the token for security reasons.`);
                                    Token
                                        .delete(token._id)
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
                                token
                                    .save()
                                    .then((token) => {
                                        const token_response = { access_token: access_token, token_type: 'Bearer', state: token.state, refresh_token: token.refresh_token };
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



