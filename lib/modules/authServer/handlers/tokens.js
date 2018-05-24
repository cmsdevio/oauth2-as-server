/* eslint-disable camelcase */
const Boom = require('boom');

const OAuthUtils = require('../utils/oauth-util');
const ClientUtils = require('../utils/client-util');
const TokenUtils = require('../utils/token-util');
const CodeUtils = require('../utils/code-util');
const InvalidClientError = require('../utils/errors-utils');
const InvalidCodeError = require('../utils/errors-utils');

module.exports.processTokenRequest = async (request, h) => {
    const Models = request.server.app.db;
    const { scope, grant_type, redirect_uri } = request.payload;
    const today = new Date();

    try {
        const { clientId, clientSecret } = OAuthUtils
            .extractHttpBasicCredentials(request.raw.req.headers.authorization, request.payload);

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

            return {
                access_token: tokenResponse.access_token,
                token_type: tokenResponse.token_type,
                scopes: tokenResponse.scopes
            };
        } else if (grant_type === 'refresh_token') {
            // TODO: implement
            return h(Boom.internal('error'));
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
        if (err instanceof InvalidClientError) {
            request.log([ 'oauth2-token-error' ], `Invalid client: ${ err }`);
            return Boom.unauthorized('invalid_client');
        } else if (err instanceof InvalidCodeError) {
            request.log([ 'oauth2-code-error' ], `Invalid code ${ err }.`);
            return Boom.unauthorized('invalid_or_expired_code');
        }

        request.log([ 'oauth2-token-error' ], `Error processing token request: ${ err.message }.`);
        return Boom.internal('error');
    }
};
