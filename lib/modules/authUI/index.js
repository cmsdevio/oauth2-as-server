const meta = require('./package');
const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const Mongoose = require('mongoose');
const Handlebars = require('handlebars');
const Wreck = require('wreck');
const Randomstring = require('randomstring');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const _ = require('lodash');
const Models = require('./persistence/mongodb/models');

Mongoose.Promise = require('bluebird');
Mongoose.set('debug', "true");
Mongoose.connect('mongodb://localhost/Oauth2', {useMongoClient: true});

// TODO: parameterize this
const apiBaseUrl = 'http://localhost:9005/oauth2';

/**************************************/
//            CATBOX CACHING
/**************************************/
const cacheOptions = {
    expiresIn: 120000,
    segment: 'requests'
};
const reqCacheClient = new Catbox.Client(CatboxMemory, cacheOptions);
/**************************************/

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
        isCached: false,
        partialsPath: Path.join(__dirname, 'views/partials'),
    });


    reqCacheClient.start((err) => {
        if (err) {
            server.log(['ui-catbox-error'], `Error starting Catbox client: ${err}.`);
        }
        server.log(['ui-catbox'], `Catbox client successfully started.`);
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
        handler: (request, reply) => {
            const req_id = Randomstring.generate(12);
            const key = { id: req_id, segment: 'requests' };
            reqCacheClient.set(key, request.query, 120000, (err) => {
                if (err) {
                    request.log(['ui-client-error'], `Error saving add client request to cache with key ${req_id}: ${err}.`);
                }
                request.log(['ui-addclient'], `Successfully persisted add client data to cache with key ${req_id}.`);
                reply.view('addclient', {
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

    server.route({
        method: 'GET',
        path: '/login',
        handler: (request, reply) => {
            const nextUrl = request.query.next;

            if (request.auth.isAuthenticated) {
                console.log('****  /login already authenticated.');
                return reply.redirect('/ui/home');
            }

            const req_id = Randomstring.generate(12);
            const key = { id: req_id, segment: 'requests' };
            reqCacheClient.set(key, request.query, 120000, (err) => {
                if (err) {
                    request.log(['ui-login-error'], `Error saving login request to cache with key ${req_id} -- defaulting to memory: ${err}.`);
                    requests[req_id] = request.query;
                }
                request.log(['ui-login'], `Successfully persisted login data to cache with key ${req_id}.`);
                reply.view('login', {
                    req_id: req_id,
                    next: nextUrl,
                    user: request.auth.credentials
                })
            });
        },
        config: {
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
        handler: (request, reply) => {

            if (request.auth.isAuthenticated) {
                console.log('****  /login already authenticated.');
                return reply.redirect('/ui/home');
            }

            const req_id = request.payload.req_id;
            request.log(['ui-login'], `Validating login POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let loginReqData;
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['ui-login-error'], `Error retrieving login data from Catbox with key ${req_id}. Falling back to memory.`);
                    loginReqData = requests[req_id];
                } else if (cached) {
                    loginReqData = cached.item;
                    request.log(['ui-login'], `Successfully retrieved item from cache with key ${req_id}: ${JSON.stringify(loginReqData)}.`);
                    const {email, password, next} = request.payload;
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['ui-login-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['ui-login'], `Successfully dropped item from cache with key ${req_id}.`);

                        Wreck.post(
                            apiBaseUrl + '/login',
                            {
                                json: true,
                                payload: {email: email, password: password}
                            },
                            (err, res, payload) => {
                                if (err) {
                                    request.log(['ui-login-error'], `Error login in: ${err}.`);
                                    return reply.view('error', {
                                        error_message: err.data.payload.message,
                                        user: request.auth.credentials
                                    });
                                }
                                if (res.statusCode !== 200) {
                                    return reply.redirect('/ui/login');
                                }
                                request.log(['ui-login'], `Successfully logged in with ${email}.`);
                                request.cookieAuth.set({token: payload.token, email: payload.email, scope: payload.scope});
                                if (next) {
                                    return reply.redirect(next);
                                } else {
                                    return reply.redirect('/ui/home');
                                }

                            });
                    });
                }

                if (!loginReqData) {
                    // No matching req_id, so the form submission is an error or attack
                    const loginRequestNotFound = `No matching login request.`;
                    request.log(['ui-login-error'], loginRequestNotFound);
                    return reply.view('error', {
                        error_message: loginRequestNotFound,
                        user: request.auth.credentials
                    });
                }
            });
        },
        config: {
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
        handler: (request, reply) => {
            request.cookieAuth.clear();
            return reply.redirect('/ui/login');
        }
    });

    next();
};



exports.register.attributes = {
    pkg: meta,
};