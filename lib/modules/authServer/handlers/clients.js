/* eslint-disable no-param-reassign */
const Joi = require('joi');
const Boom = require('boom');

const TokenUtils = require('../utils/token-util');
const ClientUtils = require('../utils/client-util');
const OAuthUtils = require('../utils/oauth-util');
const UrlUtils = require('../utils/url-utils');
const InvalidClientError = require('../utils/errors-utils');

const genericErrorMessage = 'Oops.. something went wrong. Please try again later.';

const basicClientSchema = {
    reqId: Joi.string().token().max(15).required(),
    client_id: Joi.string().regex(/^[a-zA-Z0-9-]{25,150}$/).required(),
    client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{25,150}$/).required(),
    client_description: Joi.string().allow(''),
    response_type: Joi.string().valid('code', 'token').required(),
    token_endpoint_auth_method: Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt')
};

const grantTypesSchema = { grant_types: Joi.array().items(Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token')) };

module.exports.authorizationSchema = {
    client_id: Joi.string().min(50).max(150).required(),
    redirect_uri: Joi.string().uri().required(),
    response_type: Joi.any().allow('code'),
    scope: Joi.string().allow('').optional(),
    state: Joi.string().token().allow('')
};

module.exports.registerClient = async (request, h) => {
    const Models = request.server.app.db;
    const { oauthOptions } = request.server.app;
    const dcrData = { ...request.payload };
    request.log([ 'oauth2-register' ], `Received DCR request ${ JSON.stringify(dcrData) }.`);

    if (!dcrData.grant_type) {
        dcrData.grant_type = [ oauthOptions.dcr.defaultGrantType ];
    }
    if (!dcrData.response_type) {
        dcrData.response_type = oauthOptions.dcr.defaultResponseType;
    }

    if (!OAuthUtils.validateDcrGrantResponseTypes(dcrData.grant_type, dcrData.response_type)) {
        return Boom.badRequest('Invalid grant_types/response_type combination.');
    }

    if (!dcrData.token_endpoint_auth_method) {
        dcrData.token_endpoint_auth_method = oauthOptions.dcr.defaultTokenEndpointAuthMethod;
    }
    dcrData.client_id = TokenUtils.generateTokenString(oauthOptions.dcr.clientIdLength);
    dcrData.client_secret = TokenUtils.generateTokenString(oauthOptions.dcr.clientSecretLength);

    dcrData.client_id_created_at = Math.floor(Date.now() / 1000);
    dcrData.client_secret_expires_at = oauthOptions.dcr.clientSecretExpiration;
    request.log([ 'oauth2-register' ], `Persisting new client: ${ JSON.stringify(dcrData) }.`);

    try {
        const client = await Models.saveClient(dcrData);
        request.log([ 'oauth2-register' ], `Successfully saved client ${ client }.`);
        return h.response(client)
            .code(201);
    } catch (err) {
        request.log([ 'oauth2-register-error' ], `Error creating client: ${ err }.`);
        if (err.code === 11000) {
            return Boom.badRequest('Client already exists.');
        }
        return Boom.internal('Error creating client.');
    }
};

module.exports.getAuthorize = async (request, h) => {
    const Models = request.server.app.db;
    const clientId = request.query.client_id;
    const { redirect_uris } = request.query;
    let clientRedirectUri;
    request.log([ 'oauth2-authorize' ], `Received request to authorize client ID ${ clientId }.`);

    try {
        const client = await Models.findClientById(clientId);

        if (!client) {
            throw new InvalidClientError(`No client found for ID ${ clientId }.`);
        }
        // If the redirectUri is incorrect...
        // we want to redirect to the one saved with the client definition
        clientRedirectUri = client.redirect_uri;

        const requestedScopes = request.query.scopes ? request.query.scopes.split(' ') : undefined;
        ClientUtils.validateClient(client, redirect_uris, clientId, null, null, requestedScopes);
        request.log([ 'oauth2-client' ], `Successfully retrieved and validated client with ID ${ clientId }`);

        return h.view('authorize', {
            client: requestedScopes ? { ...client, scopes: requestedScopes } : client,
            redirect_uris,
            reqId: request.pre.reqId,
            user: request.auth.credentials
        });
    } catch (error) {
        request.log([ 'oauth2-authorize-error' ], `Error processing authorization for client with ID ${ clientId }: ${ error }.`);
        const urlParsed = UrlUtils.buildUrl(clientRedirectUri || redirect_uris, {
            error: error instanceof InvalidClientError ? error.message : genericErrorMessage
        });
        return h.redirect(urlParsed);
    }
};

module.exports.clientApproval = async (request, h) => {
    const Models = request.server.app.db;
    const authReqData = request.pre.reqData;
    const { oauthOptions } = request.server.app;
    // Performing validation here, since scope is submitted by client:
    // i.e.: request.payload will contain zero or more scopes,
    // as approved by the Resource Owner
    const decisionSchema = Joi.string().allow([ 'approve', 'deny' ]);
    const { reqId, decision } = request.payload;

    try {
        Joi.assert(decision, decisionSchema);
    } catch (err) {
        return Boom.badRequest('Decision must be either `approve` or `deny`.');
    }

    if (decision === 'deny') {
        request.log([ 'oauth2-approve-error' ], 'Owner denied client access.');
        const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uri, {
            error: 'access_denied'
        });
        return h.redirect(urlParsed);
    }

    request.log([ 'oauth2-approve' ], 'Owner approved client access.');
    // What scope did the Resource Owner approved the client for?
    const requestedScopesArray = authReqData.scopes ? authReqData.scopes.split(' ') : undefined;
    const approvedScopes = ClientUtils.checkApprovedScopes(requestedScopesArray, request.payload);
    request.log([ 'oauth2-approve' ], `List of approved scopes: ${ approvedScopes }.`);

    if (authReqData.response_type === 'code') {
        request.log([ 'oauth2-approve' ], 'Processing grant type: authorization code.');
        const code = TokenUtils.generateTokenString();

        // delete authReqData.response_type;
        const ttl = new Date();
        ttl.setDate(ttl.getDate() + oauthOptions.authGrantType.codeTTL);
        const codeData = { code, ttl };

        try {
            const savedCode = await Models.saveCode({
                ...authReqData,
                ...codeData,
                scopes: approvedScopes
            });
            request.log([ 'oauth2-code' ], `Generated and persisted code ${ savedCode }.`);
            const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uris, {
                code: savedCode.code,
                state: authReqData.state
            });
            return h.redirect(urlParsed);
        } catch (error) {
            request.log([ 'oauth2-code-error' ], `Error saving code ${ code }: ${ error }.`);
            const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uris, {
                error: 'error_generating_code'
            });
            return h.redirect(urlParsed);
        }
    } else {
        request.log([ 'oauth2-approve-error' ], `Request type not supported: ${ authReqData.response_type }.`);
        const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uris, {
            error: 'unsupported_response_type'
        });
        return h.redirect(urlParsed);
    }
};

module.exports.getAddClient = (request, reply) =>
    reply.view('addclient', {
        reqId: request.pre.reqId,
        user: request.auth.credentials
    });

module.exports.postClient = (request, reply) => {
    const Models = request.server.app.db;
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

module.exports.validateClientPayload = (val, options, next) => {
    console.log(`Custom validating payload: ${ JSON.stringify(val) }`);
    const formErrors = {};
    const customErrorMessages = {
        reqId: 'should be a valid email address',
        client_id: 'should be 8 to 30 characters long, and only include letters and numbers and "-_"',
        client_secret: 'should be 8 t0 30 characters long, and only include letters and numbers and "-_"',
        redirect_uris: 'should be a comma separated list of maximum 5 URIs',
        grant_types: 'should be one of the following values: Authorization Code, ClientUtils Credentials, or Refresh Token',
        token_endpoint_auth_method: 'should be one of the following values: client_secret_basic, client_secret_post, client_secret_jwt, or private_key_jwt',
        response_type: 'Can only be "code" with a grant type of "Authorization Code and "token" with "implicit", or either with "ClientUtils Credentials"',
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

module.exports.getClients = async (request, reply) => {
    const user = { ...request.auth.credentials };
    const Models = request.server.app.db;
    try {
        const dbUser = await Models.findUserById(user._id);
        const listClients = await Models.findListClientsByIds(dbUser.client_refs);
        return reply({ listClients });
    } catch (err) {
        request.log([ 'admin-clients-error' ], `Error fetching clients: ${ err }.`);
        return reply(Boom.internal('Error fetching list of clients.'));
    }
};

module.exports.failActionPostclientValidation = (request, reply, source, error) =>
    reply.view('addclient', {
        errors: error.data,
        values: request.payload,
        reqId: request.payload.reqId,
        user: request.auth.credentials
    }).code(400);
