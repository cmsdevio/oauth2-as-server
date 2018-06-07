/* eslint-disable no-param-reassign */
const Joi = require('joi');
const Boom = require('boom');

const TokenUtils = require('../utils/token-util');
const ClientUtils = require('../utils/client-util');
const UrlUtils = require('../utils/url-utils');
const Errors = require('../utils/errors-utils');

const genericErrorMessage = 'Oops.. something went wrong. Please try again later.';

module.exports.registerClient = async (request, h) => {
    const Models = request.server.app.db;
    const { oauthOptions } = request.server.app;
    const dcrData = { ...request.payload };
    let refreshToken;
    request.log([ 'oauth2-register' ], `Received DCR request ${ JSON.stringify(dcrData) }.`);

    if (!dcrData.client_name) {
        dcrData.client_name = `dcrGenerated_${ TokenUtils.generateTokenString() }`;
    }
    // TODO: validate grant types
    if (!dcrData.grant_types) {
        dcrData.grant_types = oauthOptions.dcr.defaultGrantTypes;
    }
    if (!dcrData.response_types) {
        dcrData.response_types = oauthOptions.dcr.defaultResponseTypes;
    }
    if (!dcrData.token_endpoint_auth_method) {
        dcrData.token_endpoint_auth_method = oauthOptions.dcr.defaultTokenEndpointAuthMethod;
    }
    if (dcrData.scope && dcrData.scope.length > 0) {
        dcrData.scopes = dcrData.scope.split(' ');
        delete dcrData.scope;
    }
    // Tokens
    dcrData.client_id = TokenUtils.generateTokenString(oauthOptions.dcr.clientIdLength);
    dcrData.client_secret = TokenUtils.generateTokenString(oauthOptions.dcr.clientSecretLength);
    if (dcrData.grant_types.includes('refresh_token')) {
        request.log([ 'oauth2-register' ], 'Generating a refresh token for the client.');
        const ttl = new Date();
        ttl.setDate(ttl.getDate() + 365);
        refreshToken = {
            refresh_token:
                    TokenUtils.generateTokenString(oauthOptions.authGrantType.refreshTokenLength),
            client_id: dcrData.client_id,
            ttl
        };
    }

    dcrData.client_id_created_at = Math.floor(Date.now() / 1000);
    dcrData.client_secret_expires_at = oauthOptions.dcr.clientSecretExpiration;

    // TODO: validate grant types/response types combinations
    /*if (!OAuthUtils.validateDcrGrantResponseTypes(dcrData.grant_types, dcrData.response_types)) {
        return Boom.badRequest('Invalid grant_types/response_types combination.');
    }*/

    request.log([ 'oauth2-register' ], `Persisting new client: ${ JSON.stringify(dcrData) }.`);
    try {
        const client = await Models.saveClient(dcrData);
        request.log([ 'oauth2-register' ], `Successfully saved client ${ client }.`);

        if (dcrData.grant_types.includes('refresh_token')) {
            await Models.saveRefreshToken(refreshToken);
            request.log([ 'oauth2-register' ], `Successfully saved refresh token ${ refreshToken }.`);
        }

        return h.response(client)
            .code(201);
    } catch (err) {
        request.log([ 'oauth2-register-error' ], `Error creating client: ${ err }.`);
        return Boom.internal('Error creating client.');
    }
};

module.exports.authorizeClient = async (request, h) => {
    const Models = request.server.app.db;
    const clientId = request.query.client_id;
    const redirectURI = request.query.redirect_uri;
    let clientRedirectUri;
    request.log([ 'oauth2-authorize' ], `Received request to authorize client ID ${ clientId }.`);

    try {
        const client = await Models.findClientById(clientId);

        if (!client) {
            throw new Errors.InvalidClientError(`No client found for ID ${ clientId }.`);
        }
        // If the submitted redirect URI is incorrect...
        // we want to redirect the error to the URI saved with the client definition
        [ clientRedirectUri,, ] = client.redirect_uris;

        const requestedScopes = request.query.scope ? request.query.scope.split(' ') : undefined;
        ClientUtils.validateClient(client, redirectURI, clientId, null, null, requestedScopes);
        request.log([ 'oauth2-client' ], `Successfully retrieved and validated client with ID ${ clientId }`);

        return h.view('authorize', {
            client: requestedScopes ? { ...client, scope: requestedScopes } : client,
            redirectURI,
            reqId: request.pre.reqId,
            user: request.auth.credentials
        });
    } catch (error) {
        request.log([ 'oauth2-authorize-error' ], `Error processing authorization for client with ID ${ clientId }: ${ error }.`);
        const urlParsed = UrlUtils.buildUrl(clientRedirectUri || redirectURI, {
            error: error instanceof Errors.InvalidClientError ? error.message : genericErrorMessage
        });
        return h.redirect(urlParsed);
    }
};

module.exports.approval = async (request, h) => {
    const Models = request.server.app.db;
    const authReqData = request.pre.reqData;
    const { oauthOptions } = request.server.app;

    // Inject default response type if none submitted or white space
    if (!authReqData.response_type || authReqData.response_type === null || authReqData.response_type.match(/^ *$/) !== null) {
        authReqData.response_type = oauthOptions.authGrantType.defaultResponseType;
    }

    // TODO: extract to custom validation function
    // Performing validation here, since scope is submitted by client:
    // i.e.: request.payload will contain zero or more scopes,
    // as approved by the Resource Owner
    const decisionSchema = Joi.string().allow([ 'approve', 'deny' ]);
    const { decision } = request.payload;

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
    const requestedScopesArray = authReqData.scope ? authReqData.scope.split(' ') : undefined;
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
            await Models.deleteCodeByClientId(authReqData.client_id);
            const savedCode = await Models.saveCode({
                ...authReqData,
                ...codeData,
                scope: approvedScopes
            });
            request.log([ 'oauth2-code' ], `Generated and persisted code ${ savedCode }.`);
            const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uri, {
                code: savedCode.code,
                state: authReqData.state
            });
            return h.redirect(urlParsed);
        } catch (error) {
            request.log([ 'oauth2-code-error' ], `Error saving code ${ code }: ${ error }.`);
            const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uri, {
                error: 'error_generating_code'
            });
            return h.redirect(urlParsed);
        }
    } else {
        request.log([ 'oauth2-approve-error' ], `Request type not supported: ${ authReqData.response_type }.`);
        const urlParsed = UrlUtils.buildUrl(authReqData.redirect_uri, {
            error: 'unsupported_response_type'
        });
        return h.redirect(urlParsed);
    }
};
