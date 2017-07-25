const meta = require('./package');
const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const Handlebars = require('handlebars');
const Wreck = require('wreck');
const Randomstring = require('randomstring');
const URL = require('url');

// TODO: parameterize this
const apiBaseUrl = 'http://localhost:9005/oauth2';

const requests = {};
const codes = {};

exports.register = (server, options, next) => {
    server.views({
        engines: { hbs: Handlebars },
        relativeTo: __dirname,
        path: Path.join(__dirname, 'views'),
        layoutPath: Path.join(__dirname, 'views/layout'),
        layout: true,
        isCached: false,
        partialsPath: Path.join(__dirname, 'views/partials'),
    });

    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: Path.join(__dirname, 'public')
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            const apiUrl = `${apiBaseUrl}/clients`;
            Wreck.get(apiUrl, {json: true}, (err, res, payload) => {
                if (err) throw err;
                console.log(payload);
                reply.view('clients', {
                    clients: payload.clients
                })
            });


        }
    });

    server.route({
        method: 'GET',
        path: '/authorize',
        handler: (request, reply) => {
            // Check if client exists, and is active
            const {client_id, redirect_uri} = request.query;
            request.log(['ui-authorize'], `Received request to authorize client ID ${client_id}`);
            const apiUrl = `${apiBaseUrl}/client?client_id=${client_id}`;
            Wreck.get(apiUrl, {json: true}, (err, res, payload) => {
                if (err) {
                    request.log(['ui-authorize-error'], `Error retrieving client ID ${client_id}: ${err}.`);
                    reply.view('error', {
                        error_message: err.data.payload.message
                    });
                    return;
                }

                if (!payload.client) {
                    const clientNotFoundMsg = `Unknown client ID ${client_id}.`;
                    request.log(['ui-authorize-error'], clientNotFoundMsg);
                    reply.view('error', {
                        error_message: clientNotFoundMsg
                    });
                } else if (payload.client.redirect_uris.indexOf(redirect_uri) === -1) {
                    const invalidUriMsg = `Invalid redirect URI ${redirect_uri}.`;
                    request.log(['ui-authorize-error'], invalidUriMsg);
                    reply.view('error', {
                        error_message: invalidUriMsg
                    });
                } else {
                    // This random ID will be sent back when the approval
                    // form is submitted, for added security
                    // TODO: persist with server caching
                    const req_id = Randomstring.generate(12);
                    requests[req_id] = request.query;

                    reply.view('authorize', {
                        client: payload.client,
                        redirect_uri: redirect_uri,
                        req_id: req_id
                    });
                }
            });
        },
        config: {
            validate: {
                query: {
                    client_id: Joi.string().max(50).required(),
                    redirect_uri: Joi.string().uri().required(),
                    response_type: Joi.any().allow('code'),
                    scope: Joi.string().allow(''),
                    state: Joi.string().token().allow('')
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/approve',
        handler: (request, reply) => {
            // TODO: retrieve from server caching
            const req_id = request.payload.req_id;
            const query = requests[req_id];
            delete requests[req_id];

            if (!query) {
                // No matching req_id, so the form submission is an error or attack
                const authRequestNotFound = `No matching authorization request.`;
                request.log(['ui-approve-error'], authRequestNotFound);
                reply.view('error', {
                    error_message: authRequestNotFound
                });
            }

            if (request.payload.approve) {
                request.log(['ui-approve'], `Owner approved client access.`);
                if (query.response_type === 'code') {
                    request.log(['ui-approve'], `Processing grant type: authorization code.`);
                    const code = Randomstring.generate(15);

                    // TODO: persist code in Mongodb with ref to client
                    codes[code] = {request: query};
                    const urlParsed = buildUrl(query.redirect_uri, {
                        code: code,
                        state: query.state
                    });
                    reply.redirect(urlParsed);
                } else {
                    request.log(['ui-approve-error'], `Request type not supported yet: ${query.response_type}.`);
                    const urlParsed = buildUrl(query.redirect_uri, {
                        error: 'unsupported_response_type'
                    });
                    reply.redirect(urlParsed);
                }
            } else {
                request.log(['ui-approve-error'], `Owner denied client access.`);
                const urlParsed = buildUrl(query.redirect_uri, {
                    error: 'access_denied'
                });
                reply.redirect(urlParsed);
            }
        },
        config: {
            validate: {
                payload: {
                    approve: Joi.any().allow(['approve', 'deny']),
                    req_id: Joi.string().token().max(12),
                }
            }
        }
    });

    next();
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