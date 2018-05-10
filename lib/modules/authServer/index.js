const meta = require('./package');
const Joi = require('joi');
const Path = require('path');
const Handlebars = require('handlebars');

const FormUtils = require('./utils/form-util');
const ClientsHandler = require('./handlers/clients');
const LoginHandler = require('./handlers/login');
const TokensHandler = require('./handlers/tokens');
const AdminClientsHandler = require('./handlers/admin-clients');
const AdminUsersHandler = require('./handlers/admin-users');

// TODO: put validation schema back in this file
exports.plugin = {
    register: (server, options) => {
        server.auth.strategy('auth-session-as', 'cookie', {
            password: process.env.COOKIE_IRON_SECRET || 'password-should-be-32-characters',
            cookie: 'hapi-oauth2-as',
            ttl: 60 * 60 * 1000,
            redirectTo: '/oauth2/login',
            appendNext: true,
            isSecure: true
        });

        server.auth.strategy('api-as', 'bearer-access-token', {
            allowMultipleHeaders: true,
            validate: LoginHandler.validateFunc
        });

        server.auth.strategy('admin-as', 'bearer-access-token', {
            allowMultipleHeaders: true,
            validate: async (request, token, h) => {
                const sessionCacheClient = server.root.app.session_caching_catbox_memory;
                let isSessionValid = false;
                let user = null;
                const key = { id: token, segment: 'sessions' };

                try {
                    const cached = await sessionCacheClient.get(key);
                    if (cached) {
                        user = cached.item;
                        server.log([ 'admin-token' ], `Successfully retrieved item from cache with key ${ token }: ${ JSON.stringify(user) }.`);
                        isSessionValid = user && user.active;
                    } else {
                        server.log([ 'admin-token-error' ], `No matching request for key ${ token }.`);
                    }
                } catch (error) {
                    server.log([ 'admin-token-error' ], `Error retrieving request data from Catbox with key ${ token }.`);
                }
                return { isSessionValid, user };
                /*sessionCacheClient.get(key, (err, cached) => {
                    if (err) {

                        throw err;
                    }
                    if (cached) {
                        user = cached.item;
                        server.log([ 'admin-token' ], `Successfully retrieved item from cache with key ${ token }: ${ JSON.stringify(user) }.`);
                        isSessionValid = user && user.active;
                    } else {
                        server.log([ 'admin-token-error' ], `No matching request for key ${ token }.`);
                    }
                    return { isSessionValid, user };
                });*/
            }
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
            path: '/oauth2/{param*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, 'public')
                }
            },
            options: {
                auth: false
            }
        });

        server.route({
            method: 'GET',
            path: '/admin/{param*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, 'public')
                }
            },
            options: {
                auth: false
            }
        });

        server.route({
            method: 'GET',
            path: '/admin',
            handler: (request, h) => {
                h.file('index.html');
            },
            options: {
                auth: false
            }
        });

        server.route({
            method: 'GET',
            path: '/oauth2/home',
            handler: (request, h) => {
                h.view('home', {
                    user: request.auth.credentials
                });
            }
        });

        // *************************************************
        // LOGIN
        // *************************************************
        server.route({
            method: 'GET',
            path: '/oauth2/login',
            handler: LoginHandler.getLogin,
            options: {
                pre: [
                    {
                        assign: 'reqId',
                        method: FormUtils.setRequestKey
                    }
                ],
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
            path: '/oauth2/login',
            handler: LoginHandler.postLogin,
            options: {
                pre: [
                    {
                        assign: 'reqData',
                        method: FormUtils.checkRequestKey
                    }
                ],
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
            method: 'POST',
            path: '/admin/login',
            handler: LoginHandler.adminPostLogin,
            options: {
                auth: false,
                validate: {
                    payload: LoginHandler.adminLoginSchema
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/oauth2/logout',
            handler: LoginHandler.logout
        });
        // END LOGIN ***************************************

        // *************************************************
        // TOKENS
        // *************************************************
        server.route({
            method: 'POST',
            path: '/oauth2/token',
            handler: TokensHandler.processTokenRequest,
            options: {
                auth: false,
                /*validate: {
                    payload: {
                        grant_type: Joi.string()
                            .valid('authorization_code', 'client_credentials', 'refresh_token').required(),
                        // TODO: scope and state should space separated strings
                        scope: Joi.string().allow('').optional(),
                        state: Joi.string().token().allow('').optional(),
                        redirect_uri: Joi.string().uri().optional()
                    }
                }*/
            }
        });
        // END TOKENS **************************************

        // *************************************************
        // CLIENTS
        // *************************************************

        server.route({
            method: 'POST',
            path: '/oauth2/register',
            handler: ClientsHandler.registerClient,
            options: {
                auth: 'api-as',
                validate: {
                    payload: ClientsHandler.registrationSchema
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/oauth2/authorize',
            handler: ClientsHandler.getAuthorize,
            options: {
                auth: 'auth-session-as',
                pre: [
                    {
                        assign: 'reqId',
                        method: FormUtils.setRequestKey
                    }
                ],
                validate: {
                    query: ClientsHandler.authorizationSchema
                }
            }
        });

        server.route({
            method: 'POST',
            path: '/oauth2/approve',
            handler: ClientsHandler.clientApproval,
            options: {
                auth: 'auth-session-as',
                pre: [
                    {
                        assign: 'reqData',
                        method: FormUtils.checkRequestKey
                    }
                ]
            }
        });
        // END CLIENTS *************************************

        // *************************************************
        // ADMIN -- CLIENTS
        // *************************************************
        server.route({
            method: 'GET',
            path: '/admin/clients',
            handler: AdminClientsHandler.getClients,
            options: {
                auth: {
                    strategy: 'admin-as'
                }
            }
        });

        server.route({
            method: 'POST',
            path: '/admin/addClient',
            handler: AdminClientsHandler.addClient,
            options: {
                auth: 'admin-as',
                validate: {
                    payload: AdminClientsHandler.basicClientSchema
                }
            }
        });
        // END ADMIN CLIENTS *******************************

        // *************************************************
        // ADMIN -- USERS
        // *************************************************
        server.route({
            method: 'GET',
            path: '/admin/users',
            handler: AdminUsersHandler.getUsers,
            options: {
                auth: {
                    strategy: 'admin-as'
                }
            }
        });

        server.route({
            method: 'POST',
            path: '/admin/addUser',
            handler: AdminUsersHandler.addUser,
            options: {
                auth: {
                    strategy: 'admin-as'
                }
            }
        });

        // END ADMIN USERS *********************************
    },
    pkg: meta
};
