/* eslint-disable no-param-reassign */
const Joi = require('joi');
const Models = require('../persistence/mongodb/models');

const basicClientSchema = {
    req_id: Joi.string().token().max(15).required(),
    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    client_description: Joi.string().allow(''),
    response_type: Joi.string().valid('code', 'token').required(),
    token_endpoint_auth_method: Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt')
};

const grantTypesSchema = { grant_types: Joi.array().items(Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token')) };

module.exports.getClients = async (request, reply) => {
    try {
        const clients = await Models.findClients();
        request.log([ 'test-clients' ], `Retrieved ${ clients.length } clients for display.`);
        return reply.view('clients', {
            clients,
            user: request.auth.credentials
        });
    } catch (err) {
        request.log([ 'oauth2-admin-getclients-error' ], `Error fetching clients: ${ err }.`);
        return reply.view('error', {
            error_message: err.message,
            user: request.auth.credentials
        });
    }
};

module.exports.getAddClientForm = (request, reply) =>
    reply.view('addclient', {
        req_id: request.pre.req_id,
        user: request.auth.credentials
    });

module.exports.postClient = (request, reply) => {
    request.log([ 'client-addclient' ], `Persisting client data ${ JSON.stringify(request.payload) }.`);
    Models
        .saveClient(request.payload)
        .then((client) => {
            request.log([ 'client-addclient' ], `Successfully created client ${ client.client_id }.`);
            return reply.redirect('/client/clients');
        }, (err) => {
            request.log([ 'client-addclient-error' ], `Error creating client: ${ err }.`);
            return reply.view('error', {
                error_message: err.message,
                user: request.auth.credentials,
                client: request.server.app.active_client.client_id ?
                    request.server.app.active_client : undefined,
                provider: request.server.app.active_provider.provider_name ?
                    request.server.app.active_provider : undefined
            });
        });
};

/*
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
*/

module.exports.validateClientPayload = (val, options, next) => {
    console.log(`Custom validating payload: ${ JSON.stringify(val) }`);
    const formErrors = {};
    const customErrorMessages = {
        req_id: 'should be a valid email address',
        client_id: 'should be 8 to 30 characters long, and only include letters and numbers and "-_"',
        client_secret: 'should be 8 t0 30 characters long, and only include letters and numbers and "-_"',
        redirect_uris: 'should be a comma separated list of maximum 5 URIs',
        grant_types: 'should be one of the following values: Authorization Code, Client Credentials, or Refresh Token',
        token_endpoint_auth_method: 'should be one of the following values: client_secret_basic, client_secret_post, client_secret_jwt, or private_key_jwt',
        response_type: 'Can only be "code" with a grant type of "Authorization Code and "token" with "implicit", or either with "Client Credentials"',
        scope: 'should be space-separated list of maximum 10 strings of alphanumerical characters'
    };

    const basicResult = Joi.validate(val, basicClientSchema, {
        abortEarly: false,
        stripUnknown: true
    });

    if (basicResult.error) {
        basicResult.error.details.forEach((detail) => {
            formErrors[detail.path] = customErrorMessages[detail.path];
        });
    }

    if (!val.client_description || (typeof val.client_description === 'string' && val.client_description.length === 0)) {
        delete val.client_description;
    }

    // Validate redirect_uris
    const redirectURIsArray = [];
    val.redirect_uris.split(',').forEach(s => redirectURIsArray.push(s.trim()));
    if (redirectURIsArray.length > 5) {
        formErrors.redirect_uris = customErrorMessages.redirect_uris;
    } else {
        try {
            redirectURIsArray.forEach(uri => Joi.assert(uri, Joi.string().uri()));
            val.redirect_uris = redirectURIsArray;
        } catch (err) {
            formErrors.redirect_uris = customErrorMessages.redirect_uris;
        }
    }

    // Validate grant_types
    const grantTypesArray = Array.isArray(val.grant_types) ? val.grant_types : [ val.grant_types ];
    try {
        Joi.assert({ grant_types: grantTypesArray }, grantTypesSchema);
        val.grant_types = grantTypesArray;
    } catch (err) {
        formErrors.grant_types = customErrorMessages.grant_types;
    }

    // Validate scope
    if (typeof val.scope === 'string' && val.scope.length > 0) {
        const arrayScopes = [];
        val.scope.split(' ').forEach(s => arrayScopes.push(s.trim()));
        if (arrayScopes.length > 10) {
            formErrors.scope = customErrorMessages.scope;
        } else {
            try {
                arrayScopes.forEach(s => Joi.assert(s, Joi.string().alphanum().min(1).max(50)));
            } catch (err) {
                formErrors.scope = customErrorMessages.scope;
            }
        }
    } else {
        delete val.scope;
    }

    // Validate response types
    if ((grantTypesArray.indexOf('authorization_code') > -1 && val.response_type !== 'code')
        || (grantTypesArray.indexOf('implicit') > -1 && val.response_type !== 'token')) {
        formErrors.response_type = customErrorMessages.response_type;
    }

    if (Object.keys(formErrors).length === 0 && formErrors.constructor === Object) {
        console.log('form_errors is empty');
        next();
    } else {
        console.log('form_errors not empty');
        console.log(formErrors);

        next(formErrors, val);
    }
};

module.exports.failActionPostclientValidation = (request, reply, source, error) => {
    reply.view('addclient', {
        errors: error.data,
        values: request.payload,
        req_id: request.payload.req_id,
        user: request.auth.credentials
    }).code(400);
};
