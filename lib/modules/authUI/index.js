const meta = require('./package');
const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const Handlebars = require('handlebars');
const Randomstring = require('randomstring');

const FormUtils = require('./utils/form-util');
const ClientsHandler = require('./handlers/clients');
const LoginHandler = require('./handlers/login');


exports.register = (server, options, next) => {
    server.auth.strategy('auth-session', 'cookie', 'required', {
        password: 'password-should-be-32-characters',
        cookie: 'hapi-oauth2-ui',
        ttl: 60 * 60 * 1000,
        redirectTo: '/ui/login',
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
        path: '/home',
        handler: (request, reply) => {
            reply.view('home', {
                user: request.auth.credentials
            })
        }
    });

    /*******************************************************************************************************/
    /*                                             Clients                                                 */
    /*******************************************************************************************************/
    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            Models
                .findClients()
                .then((clients) => {
                    request.log(['ui-clients'], `Retrieved ${clients.length} clients for display.`);
                    return reply.view('clients', {
                        clients: payload.clients,
                        user: request.auth.credentials
                    });
                }, (err) => {
                    request.log(['ui-clients-error'], `Error retrieving clients: ${err}.`);
                    return reply.view('error', {
                        error_message: err.message,
                        user: request.auth.credentials
                    });
                });
        },
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    server.route({
       method: 'GET',
       path: '/client/{id}/{action}',
       handler: (request, reply) => {

           const client_id = request.params.id;
           const action = request.params.action;
           request.log(['ui-client'], `Applying action ${action} to client ${client_id}.`);

           switch(action) {
               case 'delete':
                   Models
                       .deleteClient(client_id)
                       .then((client) => {
                           request.log(['ui-client'], `Successfully deleted client ${client_id}.`);
                           return reply.redirect('/ui/clients');
                       }, (err) => {
                           request.log(['ui-client-error'], `Error deleting client ${client_id}: ${err}.`);
                           return reply.view('error', {
                               error_message: err.message,
                               user: request.auth.credentials
                           });
                       });
                   break;
               case 'activate':
                   // TODO
                   break;
               case 'deactivate':
                   // TODO
                   break;
           }
           // TODO: validation of params
       },
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/addclient',
        handler: ClientsHandler.getAddClient,
        config: {
            auth: {
                scope: 'admin'
            },
            pre: [{
                assign: 'req_id',
                method: FormUtils.setRequestKey
            }]
        }
    });

    server.route({
        method: 'POST',
        path: '/addclient',
        handler: (request, reply) => {
            const {req_id, client_id, client_secret} = request.payload;
            request.log(['ui-addclient'], `Validating add client POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let addClientReqData;
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['ui-addclient-error'], `Error retrieving add client data from Catbox with key ${req_id}. Falling back to memory.`);
                    addClientReqData = requests[req_id];
                } else if (cached) {
                    addClientReqData = cached.item;
                    request.log(['ui-addclient'], `Successfully retrieved item from cache with key ${req_id}: ${addClientReqData}.`);
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['ui-addclient-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['ui-addclient'], `Successfully dropped item from cache with key ${req_id}.`);

                        const redirectUris = [];
                        Object.keys(request.payload).forEach((key) => {
                           if (key.startsWith('redirect') && request.payload[key] !== '') {
                               redirectUris.push(request.payload[key]);
                           }
                        });

                        const clientPayload = {
                            client_id: client_id,
                            client_secret: client_secret,
                            redirect_uris: redirectUris
                        };

                        if (request.payload.scope.length !== 0) {
                            clientPayload.scope = request.payload.scope;
                        }

                        Models
                            .findClientById(client_id)
                            .then((client) => {
                                if (!client) {
                                    const client_data = Object.assign({}, request.payload, {active: true});

                                    Models
                                        .saveClient(client_data)
                                        .then((client) => {
                                            request.log(['ui-addclient'], `Successfully created client ${client.client_id}.`);
                                            return reply.redirect('/ui/clients');
                                        }, (err) => {
                                            request.log(['ui-addclient-error'], `Error creating client: ${err}.`);
                                            return reply.view('error', {
                                                error_message: err.message,
                                                user: request.auth.credentials
                                            });
                                        });
                                } else {
                                    request.log(['oauth2-client-error'], `Client already exists: ${client_id}.`);
                                    return reply.view('addclient', {
                                            errors: {clientId: 'client ID already taken'},
                                            values: request.payload,
                                            req_id: req_id,
                                            user: request.auth.credentials
                                        }).code(400);
                                }
                            }, (err) => {
                                request.log(['oauth2-client-error'], `Error checking if client ${client_id} exists: ${err}.`);
                                return reply.view('error', {
                                    error_message: err.message,
                                    user: request.auth.credentials
                                });
                            });
                    });
                }

                if (!addClientReqData) {
                    // No matching req_id, so the form submission is an error or attack
                    const addClientRequestNotFound = `No matching add client request.`;
                    request.log(['ui-addclient-error'], addClientRequestNotFound);
                    reply.view('error', {
                        error_message: addClientRequestNotFound
                    });
                }
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
                    scope: Joi.string().allow(''),
                    redirect_uri: Joi.string().uri().required(),
                    redirect_uri_1: Joi.string().uri().allow(''),
                    redirect_uri_2: Joi.string().uri().allow(''),
                    redirect_uri_3: Joi.string().uri().allow(''),
                    req_id: Joi.string().token().max(15).required()
                },
                options: {
                    abortEarly: false
                },
                failAction: function(request, reply, source, error) {
                    const errors = {};
                    const details = error.data.details;
                    const customErrorMessages = {
                        client_id: 'should be 3 tp 30 characters long, and only include letters and numbers and "-_"',
                        client_secret: 'should be 3 tp 30 characters long, and only include letters and numbers and "-_"',
                        scope: 'should be strings separated by spaces',
                        redirect_uri: 'should be a valid URI',
                        redirect_uri_1: 'should be a valid URI',
                        redirect_uri_2: 'should be a valid URI',
                        redirect_uri_3: 'should be a valid URI'
                    };
                    details.forEach((detail) => {
                        if (!errors.hasOwnProperty(detail.path)) {
                            errors[detail.path] = customErrorMessages[detail.path];
                        }
                    });

                    reply.view('adlient', {
                        errors: errors,
                        values: request.payload,
                        req_id: request.payload.req_id,
                        user: request.auth.credentials
                    }).code(400);
                }
            }
        }
    });
    // END CLIENTS --------------------------------------------------------------------------------------------

    /*******************************************************************************************************/
    /*                                              Users                                                  */
    /*******************************************************************************************************/
    server.route({
        method: 'GET',
        path: '/users',
        handler: (request, reply) => {
            Models
                .findUsers()
                .then((users) => {
                    request.log(['ui-users'], `Retrieved ${users.length} users for display.`);
                    return reply.view('users', {
                        users: payload.users,
                        user: request.auth.credentials
                    })
                }, (err) => {
                    request.log(['ui-users-error'], `Error retrieving users: ${err}.`);
                    return reply.view('error', {
                        error_message: err.data.payload.message,
                        user: request.auth.credentials
                    });
                });
        },
        config: {
            auth: {
                scope: 'admin'
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/adduser',
        handler: (request, reply) => {
            const req_id = Randomstring.generate(12);
            const key = { id: req_id, segment: 'requests' };
            reqCacheClient.set(key, request.query, 120000, (err) => {
                if (err) {
                    request.log(['ui-adduser-error'], `Error saving add user request to cache with key ${req_id}: ${err}.`);
                }
                request.log(['ui-adduser'], `Successfully persisted add user data to cache with key ${req_id}.`);
                reply.view('adduser', {
                    req_id: req_id,
                    user: request.auth.credentials
                })
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
        path: '/adduser',
        handler: (request, reply) => {
            const req_id = request.payload.req_id;
            request.log(['ui-adduser'], `Validating add user POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let addUserReqData;
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['ui-adduser-error'], `Error retrieving add user data from Catbox with key ${req_id}. Falling back to memory.`);
                    addUserReqData = requests[req_id];
                } else if (cached) {
                    addUserReqData = cached.item;
                    request.log(['ui-approve'], `Successfully retrieved item from cache with key ${req_id}: ${addUserReqData}.`);
                    const {email, password, rePassword} = request.payload;

                    // TODO: use SHA-256
                    if (rePassword !== password) {
                        reply.view('adduser', {
                            errors: {rePassword: 'passwords do not match'},
                            values: request.payload,
                            req_id: request.payload.req_id,
                            user: request.auth.credentials
                        }).code(400);
                        return;
                    }
                    // if form is valid
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['ui-adduser-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['ui-adduser'], `Successfully dropped item from cache with key ${req_id}.`);

                        Models
                            .findUserByEmail(email)
                            .then((user) => {
                                if (!user) {
                                    Models
                                        .saveUser(Object.assign({}, request.payload, {role: 'user', active: true}))
                                        .then((user) => {
                                            request.log(['ui-adduser'], `Successfully created user ${user.email}.`);
                                            return reply.redirect('/ui/users');
                                        }, (err) => {
                                            request.log(['oauth2-user-error'], `Error creating user: ${err}.`);
                                            return reply(Boom.internal(`Error creating new user.`));
                                        });
                                } else {
                                    request.log(['ui-adduser-error'], `User ${user.email} already exists.`);
                                    return reply.view('adduser', {
                                            errors: {email: 'email address already taken'},
                                            values: request.payload,
                                            req_id: request.payload.req_id,
                                            user: request.auth.credentials
                                        }).code(400);
                                }
                            }, (err) => {
                                request.log(['ui-adduser-error'], `Error creating user: ${err}.`);
                                return reply.view('error', {
                                    error_message: err.message,
                                    user: request.auth.credentials
                                });
                            });
                    });
                }

                if (!addUserReqData) {
                    // No matching req_id, so the form submission is an error or attack
                    const addUserRequestNotFound = `No matching add user request.`;
                    request.log(['ui-adduser-error'], addUserRequestNotFound);
                    reply.view('error', {
                        error_message: addUserRequestNotFound,
                        user: request.auth.credentials
                    });
                }
            });
        },
        config: {
            auth: {
                scope: 'admin'
            },
            validate: {
                payload: {
                    email: Joi.string().email().required(),
                    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
                    rePassword: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
                    req_id: Joi.string().token().max(15).required()
                },
                options: {
                    abortEarly: false
                },
                failAction: function(request, reply, source, error) {
                    const errors = {};
                    const details = error.data.details;
                    const customErrorMessages = {
                        email: 'should be a valid email address',
                        password: 'should be 3 tp 30 characters long, and only include letters and numbers'
                    };
                    details.forEach((detail) => {
                        if (!errors.hasOwnProperty(detail.path)) {
                            errors[detail.path] = customErrorMessages[detail.path];
                        }
                    });

                    reply.view('adduser', {
                        errors: errors,
                        values: request.payload,
                        req_id: request.payload.req_id,
                        user: request.auth.credentials
                    }).code(400);
                }
            }
        }
    });
    // END USERS --------------------------------------------------------------------------------------------

    /*******************************************************************************************************/
    /*                                             Login                                                   */
    /*******************************************************************************************************/
    server.route({
        method: 'GET',
        path: '/login',
        handler: LoginHandler.getLogin,
        config: {
            pre: [{
                assign: 'req_id',
                method: FormUtils.setRequestKey
            }],
            auth: {
                strategy:'auth-session',
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
            pre: [{
                assign: 'req_data',
                method: FormUtils.checkRequestKey
            }],
            auth: {
                strategy:'auth-session',
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
        handler: LoginHandler.logout
    });
    // END LOGIN ----------------------------------------------------------------------------------------------

    next();
};



exports.register.attributes = {
    pkg: meta,
};