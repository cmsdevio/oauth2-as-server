const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Mongoose = require('mongoose');
const Randomstring = require('randomstring');
const ClientPersistence = require('./persistence/clients/clientsMongoose');
const CodePersistence = require('./persistence/codes/codesMongoose');
const UserPersistence = require('./persistence/users/usersMongoose');

const querystring = require('querystring');
const Client = new ClientPersistence();
const Code = new CodePersistence();
const User = new UserPersistence();

Mongoose.Promise = require('bluebird');
Mongoose.set('debug', "true");
Mongoose.connect('mongodb://localhost/Oauth2', {useMongoClient: true});


exports.register = (server, options, next) => {
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
        }
    });

    server.route({
        method: 'POST',
        path: '/user',
        handler: (request, reply) => {
            let newUser = User.create(request.payload);
            // Save the object
            newUser
                .save((err, user) => {
                    if (err) {
                        console.error(err);
                        reply(Boom.internal(`Error creating new user.`));
                    }
                    console.log('User: ' + user);
                    reply({user: user});
                // reply({success: true});
                });
        },
        // config: {
        //     validate: {
        //         payload: {
        //             client_id: Joi.string().max(250).required(),
        //             client_secret: Joi.string().max(250).required(),
        //             active: Joi.boolean()
        //         }
        //     }
        // }
    });

    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            Client
                .find()
                .then((clients) => {
                    reply({clients: clients});
                }, (err) => {
                    request.log(['oauth2-clients-error'], `Error retrieving clients: ${err}.`);
                    reply(Boom.internal(`An error occurred: ${err.message}`));
                });
        }
    });

    server.route({
        method: 'POST',
        path: '/client',
        handler: (request, reply) => {
            let newClient = new Client(request.payload);
            // Save the object
            newClient.save((err, newClient) => {
                if (err) return console.error(err);
                reply({success: true});
            });
        },
        // config: {
        //     validate: {
        //         payload: {
        //             client_id: Joi.string().max(250).required(),
        //             client_secret: Joi.string().max(250).required(),
        //             active: Joi.boolean()
        //         }
        //     }
        // }
    });

    server.route({
        method: 'GET',
        path: '/client',
        handler: (request, reply) => {
            const clientId = request.query.client_id;
            request.log(['oauth2-client'], `Retrieving client ID ${clientId}`);
            Client
                .findByClientId(clientId)
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
            let newCode = Code.create(request.payload);
            const codeValue = request.payload.value;
            newCode
                .save()
                .then((code) => {
                    request.log(['oauth2-code'], `Saved code ${code.value}.`);
                    reply({code: code});
                }, (err) => {
                    request.log(['oauth2-code-error'], `Error saving code ${codeValue}: ${err}.`);
                    reply(Boom.internal(`Error saving code.`));
                });
        },
        // TODO: size of token, client_id should be parameterized
        config: {
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

                    const {grant_type, code} = request.payload;
                    if (grant_type === 'authorization_code') {
                        Code
                            .findByValue(code)
                            .then((data) => {
                                if (!data) {
                                    request.log(['oauth2-token-error'], `Unknown code ${code}.`);
                                    reply(Boom.unauthorized('invalid_grant'));
                                    return;
                                }
                                // Found the code, ready to issue the token
                                request.log(['oauth2-token'], `Found matching code ${data.value}.`);
                                if (data.client_id === clientId) {
                                    const access_token = Randomstring.generate(25);
                                    const token_response = { access_token: access_token, token_type: 'Bearer', state: data.state };
                                    console.log(token_response);
                                    reply(token_response);

                                } else {
                                    request.log(['oauth2-token-error'], `Client mismatch, expected ${data.client_id} got ${clientId}.`);
                                    reply(Boom.unauthorized('invalid_grant'));
                                }

                            }, (err) => {
                                request.log(['oauth2-token-error'], `Error retrieving code ${code}: ${err}.`);
                            });

                    } else {
                        // TODO: support other grant types
                        request.log(['oauth2-token-error'], `Unknown grant type ${grant_type}.`);
                        reply(Boom.badRequest('invalid_grant'));
                    }
                }, (err) => {
                    // TODO: log stack
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



