const meta = require('./package');
const Joi = require('joi');
const Path = require('path');
const Handlebars = require('handlebars');

const FormUtils = require('./utils/form-util');
const ClientsHandler = require('./handlers/clients');
const LoginHandler = require('./handlers/login');
const TokensHandler = require('./handlers/tokens');
const AdminClientsHandler = require('./handlers/admin-clients');

// TODO: put validation schema back in this file
exports.register = (server, options, next) => {
    server.auth.strategy('auth-session-as', 'cookie', 'required', {
        password: process.env.COOKIE_IRON_SECRET || 'password-should-be-32-characters',
        cookie: 'hapi-oauth2-as',
        ttl: 60 * 60 * 1000,
        redirectTo: '/oauth2/login',
        appendNext: true,
        isSecure: true
    });

    server.auth.strategy('api-as', 'bearer-access-token', {
        allowMultipleHeaders: true,
        validateFunc: LoginHandler.validateFunc
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
        path: '/home',
        handler: (request, reply) => {
            reply.view('home', {
                user: request.auth.credentials
            });
        }
    });

    // *************************************************
    // LOGIN
    // *************************************************
    server.route({
        method: 'GET',
        path: '/login',
        handler: LoginHandler.getLogin,
        config: {
            pre: [ {
                assign: 'req_id',
                method: FormUtils.setRequestKey
            } ],
            auth: {
                strategy: 'auth-session-as',
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
        handler: LoginHandler.postLogin,
        config: {
            pre: [ {
                assign: 'req_data',
                method: FormUtils.checkRequestKey
            } ],
            auth: {
                strategy: 'auth-session-as',
                mode: 'try'
            },
            plugins: {
                'hapi-auth-cookie': {
                    redirectTo: false
                }
            },
            validate: {
                payload: LoginHandler.loginSchema
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/logout',
        handler: LoginHandler.logout
    });
    // END LOGIN *****************************************

    // *************************************************
    // TOKENS
    // *************************************************
    server.route({
        method: 'POST',
        path: '/token',
        handler: TokensHandler.processTokenRequest,
        config: {
            auth: 'api-as',
            validate: {
                payload: {
                    grant_type: Joi.string()
                        .valid('authorization_code', 'client_credentials', 'refresh_token').required(),
                    // TODO: scope and state should space separated strings
                    scope: Joi.string().allow('').optional(),
                    state: Joi.string().token().allow('').optional(),
                    redirect_uri: Joi.string().uri().optional()
                }
            }
        }
    });
    // END TOKENS *****************************************

    // *************************************************
    // CLIENTS
    // *************************************************

    server.route({
        method: 'POST',
        path: '/register',
        handler: ClientsHandler.registerClient,
        config: {
            auth: 'api-as',
            validate: {
                payload: ClientsHandler.registrationSchema
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/authorize',
        handler: ClientsHandler.getAuthorize,
        config: {
            pre: [ {
                assign: 'req_id',
                method: FormUtils.setRequestKey
            } ],
            validate: {
                query: ClientsHandler.authorizationSchema
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/approve',
        handler: ClientsHandler.clientApproval,
        config: {
            pre: [ {
                assign: 'req_data',
                method: FormUtils.checkRequestKey
            } ]
        }
    });
    // END CLIENTS *****************************************

    // *************************************************
    // ADMIN -- CLIENTS
    // *************************************************
    server.route({
        method: 'GET',
        path: '/clients',
        handler: AdminClientsHandler.getClients,
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    next();
};

exports.register.attributes = {
    pkg: meta
};
