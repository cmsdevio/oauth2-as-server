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

    const clients = [
        {
            client_id: 'client-id-1',
            client_secret: 'client-secret-1',
            redirect_uris: 'http://foo.com/bar'
        }
    ];

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
            const apiUrl = `${apiBaseUrl}/clients?client_id=${client_id}`;
            Wreck.get(apiUrl, {json: true}, (err, res, payload) => {
                if (err) throw err;
                console.log(payload);

                if (!payload.client) {
                    // TODO: display a web page with the error message
                    reply(Boom.badRequest(`Unknown client: ${client_id}`));
                } else if (payload.client.redirect_uris.indexOf(redirect_uri) === -1) {
                    reply(Boom.badRequest(`No match found for the redirect URI: ${redirect_uri}`));
                } else {
                    // This random ID will be sent back when the approval
                    // form is submitted, for added security
                    // TODO: persist in database
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
                    client_id: Joi.string().max(250).required(),
                    redirect_uri: Joi.string().uri().required(),
                    response_type: Joi.string(),
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
            const req_id = request.payload.req_id;
            const query = requests[req_id];
            delete requests[req_id];

            if (!query) {
                // No matching req_id, so the form submission is an error or attack
                reply(Boom.badRequest(`No matching authorization request.`));
            }

            if (request.payload.approve) {
                // Resource owner granted access to client
                if (query.response_type === 'code') {
                    const code = Randomstring.generate(15);

                    // TODO: persist code in Mongodb with ref to client
                    codes[code] = {request: query};
                    const urlParsed = buildUrl(query.redirect_uri, {
                        code: code,
                        state: query.state
                    });
                    reply.redirect(urlParsed);

                }
            } else {
                // Resource owner denied client access to the resource

            }

            // reply({success: true});
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