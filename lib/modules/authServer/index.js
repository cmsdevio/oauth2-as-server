const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Promise = require("bluebird");
const ClientPersistence = require('./persistence/clients/clientsMongoose');

const querystring = require('querystring');
const Client = new ClientPersistence();


exports.register = (server, options, next) => {
    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            const clients = Client.find();
            reply({clients: clients});
        }
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
                    request.log(['oauth2-client-error'], `Error retrieving client ID ${clientId}: ${err}`);
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
        path: '/clients',
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

                    const grantType = request.payload.grant_type;
                    if (grantType === 'authorization_code') {



                    } else {
                        // TODO: support other grant types
                        request.log(['oauth2-token-error'], `Unknown grant type ${grantType}.`);
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



