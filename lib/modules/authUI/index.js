const meta = require('./package');
const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const Handlebars = require('handlebars');
const Wreck = require('wreck');
const Randomstring = require('randomstring');
const URL = require('url');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');
const _ = require('lodash');

// TODO: parameterize this
const apiBaseUrl = 'http://localhost:9005/oauth2';

const codes = {};

/**************************************/
//            CATBOX CACHING
/**************************************/
const cacheOptions = {
    expiresIn: 120000,
    segment: 'requests'
};
const reqCacheClient = new Catbox.Client(CatboxMemory, cacheOptions);
// Fallback in case of Catbox client error
const requests = {};
/**************************************/

exports.register = (server, options, next) => {
    server.auth.strategy('auth-session', 'cookie', 'required', {
        password: 'password-should-be-32-characters',
        cookie: 'hapi-oauth2-as',
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
            // Fallback to using memory
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
            const apiUrl = `${apiBaseUrl}/clients`;
            Wreck.get(
                apiUrl,
                {
                    json: true,
                    headers: {
                        'Authorization': 'Bearer ' + request.auth.credentials.token
                    }
                },
                (err, res, payload) => {
                    if (err) {
                        if (err.data.payload.statusCode === 401) {
                            request.log(['ui-clients-error'], `API Bearer Token out of sync: ${err}.`);
                            return reply.redirect('/ui/logout');
                        }
                        request.log(['ui-clients-error'], `Error retrieving clients: ${err}.`);
                        return reply.view('error', {
                            error_message: err.data.payload.message,
                            user: request.auth.credentials
                        });
                    }
                    request.log(['ui-clients'], `Retrieved ${payload.clients.length} clients for display.`);
                    // TODO: display message if no data, instead of empty table
                    reply.view('clients', {
                        clients: payload.clients,
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
           const apiUrl = `${apiBaseUrl}/client`;
           switch(action) {
               case 'delete':
                   Wreck.delete(
                       apiUrl,
                       {
                           json: true,
                           payload: {client_id: client_id},
                           headers: {
                               'Authorization': 'Bearer ' + request.auth.credentials.token
                           }
                       },
                       (err, res, payload) => {
                           if (err) {
                               if (err.data.payload.statusCode === 401) {
                                   request.log(['ui-client-error'], `API Bearer Token out of sync: ${err}.`);
                                   return reply.redirect('/ui/logout');
                               }
                               request.log(['ui-client-error'], `Error deleting client ${client_id}: ${err}.`);
                               return reply.view('error', {
                                   error_message: err.data.payload.message,
                                   user: request.auth.credentials
                               });
                           }
                           request.log(['ui-client'], `Successfully deleted client ${client_id}.`);
                           return reply.redirect('/ui/clients');
                       }
                   );
                   break;
               case 'activate':
                   Wreck.put(
                       apiUrl,
                       {
                           json: true,
                           payload: {client_id: client_id, active: true},
                           headers: {
                               'Authorization': 'Bearer ' + request.auth.credentials.token
                           }
                       },
                       (err, res, payload) => {
                           if (err) {
                               if (err.data.payload.statusCode === 401) {
                                   request.log(['ui-client-error'], `API Bearer Token out of sync: ${err}.`);
                                   return reply.redirect('/ui/logout');
                               }
                               request.log(['ui-client-error'], `Error deleting client ${client_id}: ${err}.`);
                               return reply.view('error', {
                                   error_message: err.data.payload.message,
                                   user: request.auth.credentials
                               });
                           }
                           request.log(['ui-client'], `Successfully deleted client ${client_id}.`);
                           return reply.redirect('/ui/clients');
                       }
                   );
                   break;
               case 'deactivate':
                   Wreck.put(
                       apiUrl,
                       {
                           json: true,
                           payload: {client_id: client_id, active: false},
                           headers: {
                               'Authorization': 'Bearer ' + request.auth.credentials.token
                           }
                       },
                       (err, res, payload) => {
                           if (err) {
                               if (err.data.payload.statusCode === 401) {
                                   request.log(['ui-client-error'], `API Bearer Token out of sync: ${err}.`);
                                   return reply.redirect('/ui/logout');
                               }
                               request.log(['ui-client-error'], `Error deleting client ${client_id}: ${err}.`);
                               return reply.view('error', {
                                   error_message: err.data.payload.message,
                                   user: request.auth.credentials
                               });
                           }
                           request.log(['ui-client'], `Successfully deleted client ${client_id}.`);
                           return reply.redirect('/ui/clients');
                       }
                   );
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
            const req_id = request.payload.req_id;
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
                            client_id: request.payload.client_id,
                            client_secret: request.payload.client_secret,
                            redirect_uris: redirectUris
                        };

                        if (request.payload.scope.length !== 0) {
                            clientPayload.scope = request.payload.scope;
                        }

                        console.log(clientPayload);
                        Wreck.post(
                            apiBaseUrl + '/client',
                            {
                                json: true,
                                headers: {
                                    'Authorization': 'Bearer ' + request.auth.credentials.token
                                },
                                payload: clientPayload
                            },
                            (err, res, payload) => {
                                if (err) {
                                    if (err.data.payload.statusCode === 401) {
                                        request.log(['ui-addclient-error'], `API Bearer Token out of sync: ${err}.`);
                                        return reply.redirect('/ui/logout');
                                    }
                                    request.log(['ui-addclient-error'], `Error creating client: ${err}.`);
                                    if (err.data.payload.message === 'Client already exists.') {
                                        reply.view('addclient', {
                                            errors: {clientId: 'client ID already taken'},
                                            values: request.payload,
                                            req_id: request.payload.req_id,
                                            user: request.auth.credentials
                                        }).code(400);
                                        return;
                                    } else {
                                        reply.view('error', {
                                            error_message: err.data.payload.message,
                                            user: request.auth.credentials
                                        });
                                        return;
                                    }
                                }
                                request.log(['ui-addclient'], `Successfully created client ${payload.client.client_id}.`);

                                reply.redirect('/ui/clients');
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

                    reply.view('addclient', {
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
            const apiUrl = `${apiBaseUrl}/users`;
            Wreck.get(
                apiUrl,
                {
                    json: true,
                    headers: {
                        'Authorization': 'Bearer ' + request.auth.credentials.token
                    }
                },
                (err, res, payload) => {
                    if (err) {
                        if (err.data.payload.statusCode === 401) {
                            request.log(['ui-users-error'], `API Bearer Token out of sync: ${err}.`);
                            return reply.redirect('/ui/logout');
                        }
                        request.log(['ui-users-error'], `Error retrieving users: ${err}.`);
                        reply.view('error', {
                            error_message: err.data.payload.message,
                            user: request.auth.credentials
                        });
                        return;
                    }
                    request.log(['ui-users'], `Retrieved ${payload.users.length} users for display.`);
                    reply.view('users', {
                        users: payload.users,
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

                        Wreck.post(
                            apiBaseUrl + '/user',
                            {
                                json: true,
                                headers: {
                                    'Authorization': 'Bearer ' + request.auth.credentials.token
                                },
                                payload: {email: email, password: password}
                            },
                            (err, res, payload) => {
                                if (err) {
                                    if (err.data.payload.statusCode === 401) {
                                        request.log(['ui-adduser-error'], `API Bearer Token out of sync: ${err}.`);
                                        return reply.redirect('/ui/logout');
                                    }
                                    request.log(['ui-adduser-error'], `Error creating user: ${err}.`);
                                    if (err.data.payload.message === 'User already exists.') {
                                        reply.view('adduser', {
                                            errors: {email: 'email address already taken'},
                                            values: request.payload,
                                            req_id: request.payload.req_id,
                                            user: request.auth.credentials
                                        }).code(400);
                                        return;
                                    } else {
                                        reply.view('error', {
                                            error_message: err.data.payload.message,
                                            user: request.auth.credentials
                                        });
                                        return;
                                    }
                                }
                                request.log(['ui-adduser'], `Successfully created user ${payload.user.email}.`);

                                reply.redirect('/ui/users');
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
            const apiUrl = `${apiBaseUrl}/logout`;
            Wreck.get(
                apiUrl,
                {
                    json: true,
                    headers: {
                        'Authorization': 'Bearer ' + request.auth.credentials.token
                    }
                },
                (err, res, payload) => {
                    if (err) {
                        request.log(['ui-logout-error'], `Error canceling Bearer token for backend: ${err}.`);
                    }
                    request.log(['ui-logout'], `Successfully canceled Bearer token for backend: ${err}.`);
                }
            );
            return reply.redirect('/ui/home');
        }
    });

    server.route({
        method: 'GET',
        path: '/authorize',
        handler: (request, reply) => {
            const {client_id, redirect_uri} = request.query;
            request.log(['ui-authorize'], `Received request to authorize client ID ${client_id}.`);

            const apiUrl = `${apiBaseUrl}/client?client_id=${client_id}`;
            Wreck.get(
                apiUrl,
                {
                    json: true,
                    headers: {
                        'Authorization': 'Bearer ' + request.auth.credentials.token
                    }
                },
                (err, res, payload) => {
                    if (err) {
                        if (err.data.payload.statusCode === 401) {
                            request.log(['ui-authorize-error'], `API Bearer Token out of sync: ${err}.`);
                            return reply.redirect('/ui/logout');
                        }
                        request.log(['ui-authorize-error'], `Error retrieving client ID ${client_id}: ${err}.`);
                        return reply.view('error', {
                            error_message: err.data.payload.message,
                            user: request.auth.credentials
                        });
                    }

                    if (!payload.client) {
                        const clientNotFoundMsg = `Unknown client ID ${client_id}.`;
                        request.log(['ui-authorize-error'], clientNotFoundMsg);
                        return reply.view('error', {
                            error_message: clientNotFoundMsg,
                            user: request.auth.credentials
                        });
                    } else if (payload.client.redirect_uris.indexOf(redirect_uri) === -1) {
                        const invalidUriMsg = `Invalid redirect URI ${redirect_uri}.`;
                        request.log(['ui-authorize-error'], invalidUriMsg);
                        return reply.view('error', {
                            error_message: invalidUriMsg,
                            user: request.auth.credentials
                        });
                    }

                    // Validate scope
                    const clientScope = payload.client.scope ? payload.client.scope.split(' ') : undefined;
                    const requestScope = request.query.scope ? request.query.scope.split(' ') : undefined;
                    if (_.difference(requestScope, clientScope).length > 0) {
                        request.log(['ui-authorize-error'], `Authorize request contains invalid scope.`);
                        const urlParsed = buildUrl(request.query.redirect_uri, {
                            error: 'invalid_scope'
                        });
                        return reply.redirect(urlParsed);
                    }

                    if (requestScope) {
                        payload.client.scope = requestScope;
                    }

                    const req_id = Randomstring.generate(12);
                    const key = { id: req_id, segment: 'requests' };
                    reqCacheClient.set(key, request.query, 120000, (err) => {
                        if (err) {
                            request.log(['ui-authorize-error'], `Error saving authorization request to cache with key ${req_id}: ${err}.`);
                            return reply(Boom.internal());
                        }
                        request.log(['ui-authorize'], `Successfully persisted authorization data to cache with key ${req_id}.`);
                        reply.view('authorize', {
                            client: payload.client,
                            redirect_uri: redirect_uri,
                            req_id: req_id,
                            user: request.auth.credentials
                        });
                    });
                });
        },
        config: {
            validate: {
                query: {
                    client_id: Joi.string().max(50).required(),
                    redirect_uri: Joi.string().uri().required(),
                    response_type: Joi.any().allow('code'),
                    scope: Joi.string().allow('').optional(),
                    state: Joi.string().token().allow('')
                }
            }
        }
    });

    server.route({
        method: 'POST',
        path: '/approve',
        handler: (request, reply) => {
            // Performing validation here, since scope is submitted by client
            const reqIdSchema = Joi.string().token().max(12);
            const decisionSchema = Joi.string().allow(['approve', 'deny']);
            const req_id = request.payload.req_id;
            const decision = request.payload.decision;
            try {
                if (!req_id) throw new Error();
                Joi.assert(req_id, reqIdSchema);
            } catch (err) {
                return reply(Boom.badRequest('req_id must be a token, with length 12'))
            }
            try {
                if (!decision) throw new Error();
                Joi.assert(decision, decisionSchema);
            } catch (err) {
                return reply(Boom.badRequest('decision must be either \`approve\` or \`deny\`'))
            }

            request.log(['ui-approve'], `Validating approval POST request with key ${req_id}.`);
            const key = { id: req_id, segment: 'requests' };
            let query;
            reqCacheClient.get(key, (err, cached) => {
                if (err) {
                    request.log(['ui-approve-error'], `Error retrieving authorization data from Catbox with key ${req_id}.`);
                    return reply(Boom.internal());
                } else if (cached) {
                    const reqData = cached.item;
                    request.log(['ui-approve'], `Successfully retrieved item from cache with key ${req_id}: ${reqData}.`);
                    // TODO: verify remaining TTL is less than two minutes
                    query = reqData;
                    reqCacheClient.drop(key, (err) => {
                        if (err) {
                            request.log(['ui-approve-error'], `Error dropping item from cache with key ${req_id}: ${err}.`);
                        }
                        request.log(['ui-approve'], `Successfully dropped item from cache with key ${req_id}.`);

                        if (decision === 'approve') {
                            request.log(['ui-approve'], `Owner approved client access. Verifying scope.`);
                            // What scope did the Resource Owner approved the client for?
                            const requestScope = query.scope ? query.scope.split(' ') : undefined;
                            const approvedScope = [];
                            if (requestScope) {
                                request.log(['ui-approve'], `Validating which scope was granted by the resource owner. Client sent: ${requestScope}.`);
                                requestScope.forEach((aScope) => {
                                    if (request.payload[aScope]) {
                                        approvedScope.push(aScope);
                                    }
                                });
                                request.log(['ui-approve'], `Resource owner gave scope: ${approvedScope}.`);
                            }

                            if (query.response_type === 'code') {
                                request.log(['ui-approve'], `Processing grant type: authorization code.`);
                                const code = Randomstring.generate(15);

                                // TODO: persist code in Mongodb with ref to client
                                delete query.response_type;
                                if (requestScope) {
                                    query.scope = approvedScope.join(' ');
                                }
                                Wreck.post(
                                    apiBaseUrl + '/code',
                                    {
                                        json: true,
                                        headers: {
                                            'Authorization': 'Bearer ' + request.auth.credentials.token
                                        },
                                        payload: JSON.stringify(Object.assign({}, query, { code: code }))
                                    },
                                    (err, res, payload) => {
                                        if (err) {
                                            if (err.data.payload.statusCode === 401) {
                                                request.log(['ui-approve-error'], `API Bearer Token out of sync: ${err}.`);
                                                return reply.redirect('/ui/logout');
                                            }
                                            request.log(['ui-approve-error'], `Error saving code ${code}: ${err}.`);
                                            const urlParsed = buildUrl(query.redirect_uri, {
                                                error: 'error_generating_code'
                                            });
                                            reply.redirect(urlParsed);
                                        }
                                        const codeObject = payload.code;
                                        request.log(['ui-approve'], `Generated and persisted code ${codeObject.code}.`);
                                        const urlParsed = buildUrl(codeObject.redirect_uri, {
                                            code: code,
                                            state: codeObject.state
                                        });
                                        reply.redirect(urlParsed);
                                    });

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
                    })
                }

                if (!query) {
                    // No matching req_id, so the form submission is an error or attack
                    const authRequestNotFound = `No matching authorization request.`;
                    request.log(['ui-approve-error'], authRequestNotFound);
                    reply.view('error', {
                        error_message: authRequestNotFound,
                        user: request.auth.credentials
                    });
                }
            });
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