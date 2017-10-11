
const Joi = require('joi');
const Boom = require('boom');

const Models = require('../persistence/mongodb/models');
const TokenUtils = require('../utils/token-util');
const Client = require('../utils/client-util');
const OAuthUtils = require('../utils/oauth-util');

const basicClientSchema = {
    req_id: Joi.string().token().max(15).required(),
    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    client_description: Joi.string().allow(''),
    response_type: Joi.string().valid('code', 'token').required(),
    token_endpoint_auth_method: Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt')
};

const grantTypesSchema = { grant_types: Joi.array().items(Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token')) };

module.exports.registrationSchema = {
    client_name: Joi.string().token().min(10).max(50).required(),
    client_uri: Joi.string().uri().optional(),
    redirect_uris: Joi.array().items(Joi.string().uri()).optional(),
    response_type: Joi.string().valid('code', 'token').optional(),
    token_endpoint_auth_method: Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt').optional(),
    grant_types: Joi.array().items(Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token')).optional(),
    scope: Joi.string().optional()
};

module.exports.authorizationSchema = {
    client_id: Joi.string().max(50).required(),
    redirect_uri: Joi.string().uri().required(),
    response_type: Joi.any().allow('code'),
    scope: Joi.string().allow('').optional(),
    state: Joi.string().token().allow('')
};

module.exports.getClients = function(request, reply) {
    Models
        .findClients()
        .then((clients) => {
            request.log(['test-clients'], `Retrieved ${clients.length} clients for display.`);
            return reply.view('clients', {
                clients: clients,
                user: request.auth.credentials
            });
        }, (err) => {
            request.log(['test-clients-error'], `Error retrieving clients: ${err}.`);
            return reply.view('error', {
                error_message: err.message,
                user: request.auth.credentials
            });
        });
};

module.exports.registerClient = function(request, reply) {
    const reg = request.payload;
    request.log(['oauth2-register'], `Received DCR request ${JSON.stringify(reg)}.`);

    if (!reg.grant_types) {
        reg.grant_types = ['authorization_code'];
    }
    if (!reg.response_type) {
        reg.response_type = ['code'];
    }

    if (reg.grant_types === 'authorization_code' && reg.response_type !== 'code' || reg.grant_types === 'authorization_code' && reg.response_type !== 'code') {
        return reply(Boom.badRequest('Invalid grant_types/response_type combination.'));
    }

    if (!reg.token_endpoint_auth_method) {
        reg.token_endpoint_auth_method = 'client_secret_basic'
    }
    //TODO: increase client id and secret size
    reg.client_id = TokenUtils.generateTokenString(15);
    reg.client_secret = TokenUtils.generateTokenString();
    reg.redirect_uris = request.payload.redirect_uris;

    reg.client_id_created_at = Math.floor(Date.now() / 1000);
    reg.client_secret_expires_at = 0;
    request.log(['oauth2-register'], `Persisting new client: ${JSON.stringify(reg)}.`);

    Models
        .saveClient(Object.assign({}, reg, {active: true}))
        .then((client) => {
            request.log(['oauth2-register'], `Successfully saved client ${client.client_id}.`);
            return reply(reg)
                .code(201);
        }, (err) => {
            request.log(['oauth2-register-error'], `Error creating client: ${err}.`);
            if (err.code === 11000) {
                return reply(Boom.badRequest('Client already exists.'));
            } else {
                return reply(Boom.internal('Error creating client.'));
            }
        });
};

module.exports.getAuthorize = function(request, reply) {
    const {client_id, redirect_uri} = request.query;
    request.log(['oauth2-authorize'], `Received request to authorize client ID ${client_id}.`);

    Models
        .findClientById(client_id)
        .then((client) => {
            if (!Client.isClientValid(client, redirect_uri, client_id, null, null)) {
                request.log(['oauth2-authorize-error'], `Invalid client ID ${client_id}.`);
                const urlParsed = buildUrl(redirect_uri, {
                    error: 'invalid_client'
                });
                return reply.redirect(urlParsed);
            }

            request.log(['oauth2-client'], `Successfully retrieved and validated client ID ${client_id}`);

            // Optional scopes must be validated
            const clientScope = client.scope ? client.scope.split(' ') : undefined;
            const requestScope = request.query.scope ? request.query.scope.split(' ') : undefined;

            if (!OAuthUtils.isScopeValid(requestScope, clientScope)) {
                request.log(['oauth-authorize-error'], `Authorize request contains invalid scope.`);
                const urlParsed = buildUrl(redirect_uri, {
                    error: 'invalid_scope'
                });
                return reply.redirect(urlParsed);
            }

            reply.view('authorize', {
                client: requestScope ? Object.assign({}, client, {scope: requestScope}) : client,
                redirect_uri: redirect_uri,
                req_id: request.pre.req_id,
                user: request.auth.credentials
            });

        }, (err) => {
            request.log(['oauth2-client-error'], `Error retrieving client ID ${client_id}: ${err}.`);
            return reply.view('error', {
                error_message: err.message,
                user: request.auth.credentials
            });
        });
};

module.exports.clientApproval = function(request, reply) {
    const authReqData = request.pre.req_data;
    // Performing validation here, since scope is submitted by client:
    // i.e.: request.payload will contain zero or more scopes,
    // as approved by the Resource Owner
    const reqIdSchema = Joi.string().token().max(25);
    const decisionSchema = Joi.string().allow(['approve', 'deny']);
    const {req_id, decision} = request.payload;

    try {
        Joi.assert(req_id, reqIdSchema);
    } catch (err) {
        return reply(Boom.badRequest('Missing req_id token.'))
    }
    try {
        Joi.assert(decision, decisionSchema);
    } catch (err) {
        return reply(Boom.badRequest('Decision must be either \`approve\` or \`deny\`.'))
    }

    if (decision === 'deny') {
        request.log(['oauth2-approve-error'], `Owner denied client access.`);
        const urlParsed = buildUrl(authReqData.redirect_uri, {
            error: 'access_denied'
        });
        reply.redirect(urlParsed);
    }

    request.log(['oauth2-approve'], `Owner approved client access. Verifying scope.`);
    // What scope did the Resource Owner approved the client for?
    const requestScope = authReqData.scope ? authReqData.scope.split(' ') : undefined;
    const approvedScope = OAuthUtils.determineScope(requestScope, request.payload);

    if (authReqData.response_type === 'code') {
        request.log(['oauth2-approve'], `Processing grant type: authorization code.`);
        const code = TokenUtils.generateTokenString();
        delete authReqData.response_type;
        let ttl = new Date();
        ttl.setDate(ttl.getDate() + 1);

        const codeData = {code: code, ttl: ttl};
        if (approvedScope && approvedScope.length > 0) {
            codeData.code = approvedScope;
        }

        Models
            .saveCode(Object.assign({}, authReqData, codeData))
            .then((code) => {
                request.log(['oauth2-code'], `Generated and persisted code ${code}.`);
                const urlParsed = buildUrl(authReqData.redirect_uri, {
                    code: code.code,
                    state: authReqData.state
                });
                reply.redirect(urlParsed);
            }, (err) => {
                request.log(['oauth2-code-error'], `Error saving code ${code}: ${err}.`);
                const urlParsed = buildUrl(authReqData.redirect_uri, {
                    error: 'error_generating_code'
                });
                reply.redirect(urlParsed);
            });

    } else {
        request.log(['oauth2-approve-error'], `Request type not supported: ${authReqData.response_type}.`);
        const urlParsed = buildUrl(authReqData.redirect_uri, {
            error: 'unsupported_response_type'
        });
        reply.redirect(urlParsed);
    }
};

// -------------------------------------------------------------------------------------------------------------------------------------------------------



module.exports.getAddClient = function(request, reply) {
    return reply.view('addclient', {
        req_id: request.pre.req_id,
        user: request.auth.credentials
    })
};

module.exports.postClient = function(request, reply) {
    request.log(['client-addclient'], `Persisting client data ${JSON.stringify(request.payload)}.`);
    Models
        .saveClient(request.payload)
        .then((client) => {
            request.log(['client-addclient'], `Successfully created client ${client.client_id}.`);
            return reply.redirect('/client/clients');
        }, (err) => {
            request.log(['client-addclient-error'], `Error creating client: ${err}.`);
            return reply.view('error', {
                error_message: err.message,
                user: request.auth.credentials,
                client: request.server.app.active_client.hasOwnProperty('client_id') ? request.server.app.active_client : undefined,
                provider: request.server.app.active_provider.hasOwnProperty('provider_name') ? request.server.app.active_provider : undefined
            });
        });
};

module.exports.validateClientPayload = (val, options, next) => {
    console.log(`Custom validating payload: ${JSON.stringify(val)}`);
    const form_errors = {};
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
        basicResult.error.details.forEach(detail => {
            form_errors[detail.path] = customErrorMessages[detail.path];
        });
    }

    if (!val.client_description || typeof val.client_description === 'string' && val.client_description.length === 0) {
        delete val.client_description;
    }

    // Validate redirect_uris
    const redirect_uris_array = [];
    val.redirect_uris.split(',').forEach(s => redirect_uris_array.push(s.trim()));
    if (redirect_uris_array.length > 5) {
        form_errors.redirect_uris = customErrorMessages.redirect_uris;
    } else {
        try {
            redirect_uris_array.forEach(uri => Joi.assert(uri, Joi.string().uri()));
            val.redirect_uris = redirect_uris_array;
        } catch(err) {
            form_errors.redirect_uris = customErrorMessages.redirect_uris;
        }
    }

    // Validate grant_types
    const grant_types_array = Array.isArray(val.grant_types) ? val.grant_types : [val.grant_types];
    try {
        Joi.assert({ grant_types: grant_types_array }, grantTypesSchema);
        val.grant_types = grant_types_array;
    } catch(err) {
        form_errors.grant_types = customErrorMessages.grant_types;
    }

    // Validate scope
    if (typeof val.scope === 'string' && val.scope.length > 0) {
        const array_scopes = [];
        val.scope.split(' ').forEach(s => array_scopes.push(s.trim()));
        if (array_scopes.length > 10) {
            form_errors.scope = customErrorMessages.scope;
        } else {
            try {
                array_scopes.forEach(s => Joi.assert(s, Joi.string().alphanum().min(1).max(50)));
            } catch(err) {
                form_errors.scope = customErrorMessages.scope;
            }
        }
    } else {
        delete val.scope;
    }

    // Validate response types
    if ((grant_types_array.indexOf('authorization_code') > -1 && val.response_type !== 'code')
        || grant_types_array.indexOf('implicit') > -1 && val.response_type !== 'token') {
        form_errors.response_type = customErrorMessages.response_type;
    }


    if (Object.keys(form_errors).length === 0 && form_errors.constructor === Object) {
        console.log('form_errors is empty');
        next();
    } else {
        console.log('form_errors not empty');
        console.log(form_errors);

        next(form_errors, val);
    }
};

module.exports.failActionPostclientValidation = function(request, reply, source, error) {
    reply.view('addclient', {
        errors: error.data,
        values: request.payload,
        req_id: request.payload.req_id,
        user: request.auth.credentials
    }).code(400);
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