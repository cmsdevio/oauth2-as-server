/* eslint-disable camelcase */
const Boom = require('boom');
const Joi = require('joi');

const OAuthUtils = require('../utils/oauth-util');
const ClientUtils = require('../utils/client-util');
const TokenUtils = require('../utils/token-util');
const CodeUtils = require('../utils/code-util');
const InvalidClientError = require('../utils/errors-utils');
const InvalidCodeError = require('../utils/errors-utils');
const MissingBasicAuthCredentialsError = require('../utils/errors-utils');
const DuplicateCredentialsError = require('../utils/errors-utils');

const clientIdSchema = Joi.string().token().length(50);
const clientSecretSchema = Joi.string().token().length(100);

module.exports.token = async (request, h) => {
    const Models = request.server.app.db;
    const { scope, grant_type, redirect_uri } = request.payload;
    const today = new Date();
    request.log([ 'oauth2-token' ], `Received request for token with payload: ${ JSON.stringify(request.payload) }.`);

    try {
        // TODO: support other auth methods than HTTP Basic
        // For example, private_key_jwt, etc....
        // Methods could be defined during dynamic client registration
        // Will need to be extracted to auth method
        const { clientId, clientSecret } = OAuthUtils
            .extractHttpBasicCredentials(request.raw.req.headers.authorization, request.payload);

        // We must ensure that ID and secret are tokens (i.e.: no sneaky MongoDB queries)
        Joi.assert(clientId, clientIdSchema);
        Joi.assert(clientSecret, clientSecretSchema);

        const client = await Models.findClientById(clientId);

        const requestScopesArray = scope && scope.length > 0 ? scope.split(' ') : undefined;
        ClientUtils.validateClient(
            client,
            redirect_uri,
            clientId,
            clientSecret,
            grant_type,
            requestScopesArray
        );

        if (grant_type === 'authorization_code') {
            const submittedCode = request.payload.code;

            const code = await Models.findCodeByValue(submittedCode);
            CodeUtils.validateCode(code, submittedCode, clientId);
            request.log([ 'oauth2-token' ], `Submitted code is valid: ${ code.code }.`);
            // if (!tokenResponse.ttl) {
            //     return h(tokenResponse);
            // }
            // TODO: token as string?

            const existingToken = await Models.findTokenByClientId(clientId);
            // TODO: validate token -> ttl
            if (existingToken && existingToken.ttl > today) {
                console.log('Found existing token');
                return h(existingToken);
            }
            // Token doesn't exist or is invalid
            await Models.deleteTokenByClientId(clientId);

            const tokenResponse = TokenUtils.generateOAuthToken(
                code,
                client.client_id,
                request.server.app.oauthOptions
            );
            request.log([ 'oauth2-token' ], `Issued new token for authorization code: ${ JSON.stringify(tokenResponse) }.`);

            await Models.saveToken(tokenResponse);
            request.log([ 'oauth2-token' ], 'Successfully persisted token.');

            await Models.deleteCode(code._id);
            request.log([ 'oauth2-token' ], `Successfully deleted code ${ code.code }.`);

            return tokenResponse;
        } else if (grant_type === 'refresh_token') {
            // TODO: implement
            return Boom.internal('error');
        } else if (grant_type === 'client_credentials') {
            const tokenResponse =
                TokenUtils.generateOAuthToken(
                    null,
                    client.client_id,
                    request.server.app.oauthOptions
                );
            request.log([ 'oauth2-token' ], `Issuing token for client credentials: ${ JSON.stringify(tokenResponse) }.`);
            return tokenResponse;
        }
    } catch (err) {
        if (err.isJoi) {
            request.log([ 'oauth2-token-error' ], `Received mal-formed request: ${ err }`);
            return Boom.badRequest('invalid_request');
        } else if (err instanceof InvalidClientError) {
            request.log([ 'oauth2-token-error' ], `Invalid client: ${ err }`);
            return Boom.forbidden('invalid_client');
        } else if (err instanceof InvalidCodeError) {
            request.log([ 'oauth2-token-error' ], `Invalid code ${ err }.`);
            return Boom.forbidden('invalid_or_expired_code');
        } else if (err instanceof MissingBasicAuthCredentialsError
            || err instanceof DuplicateCredentialsError) {
            request.log([ 'oauth2-token-error' ], `Missing or duplicated basic auth credentials: ${ err }`);
            // TODO: should error classes contains standard reply message?
            return Boom.unauthorized('invalid_credentials');
        }

        request.log([ 'oauth2-token-error' ], `Error processing token request: ${ err.message }.`);
        return Boom.internal('error');
    }
};
