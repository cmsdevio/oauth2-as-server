const Boom = require('boom');

const OAuthUtils = require('../utils/oauth-util');
const Models = require('../persistence/mongodb/models');
const Client = require('../utils/client-util');
const TokenUtils = require('../utils/token-util');
const Code = require('../utils/code-util');

module.exports.processTokenRequest = function(request, reply) {
    const {client_id, client_secret} = OAuthUtils.extractHttpBasicCredentials(request.raw.req.headers["authorization"], request.payload);
    const grant_type = request.payload.grant_type;

    Models
        .findClientById(client_id)
        .then((client) => {
            if (!Client.isClientValid(client, null, client_id, client_secret, grant_type)) {
                request.log(['oauth2-token-error'], `Invalid client ID ${client_id}.`);
                return reply(Boom.unauthorized(`invalid_client`));
            }

            const clientScope = client.scope ? client.scope.split(' ') : undefined;
            const reqScope = request.payload.scope ? request.payload.scope.split(' ') : undefined;
            if (!OAuthUtils.isScopeValid(reqScope, clientScope)) {
                request.log(['oauth-token-error'], `Token request contains invalid scope.`);
                return reply(Boom.unauthorized(`invalid_scope`));
            }

            if (grant_type === 'authorization_code') {
                const codeValue = request.payload.code;
                Models
                    .findCodeByValue(codeValue)
                    .then(code => {
                        if (!Code.isCodeValid(code, codeValue, client_id)) {
                            request.log(['oauth2-token-error'], `Invalid code ${codeValue}.`);
                            return reply(Boom.unauthorized('invalid_or_expired_code'));
                        }

                        request.log(['oauth2-token'], `Found matching code ${code.code}.`);
                        const token_response = TokenUtils.generateOAuthToken(code, client.client_id, request.server.root.app.oauth_options);
                        request.log(['oauth2-token'], `Issuing authorization code token: ${JSON.stringify(token_response)}.`);

                        // If token is string, we persist it for later revocation and refresh
                        if (!token_response.ttl) {
                            return reply(token_response);
                        } else {
                            Models
                                .deleteTokenByClientId(client_id)
                                .then((result) => {
                                    request.log(['oauth2-token'], `Deleted existing token: ${result}.`);
                                    Models
                                        .saveToken(token_response)
                                        .then(token => {
                                            request.log(['oauth2-token'], `Successfully persisted token ${token}. Sending it to client.`);
                                            Models
                                                .deleteCode(code._id)
                                                .then((code) => {
                                                    request.log(['oauth2-token'], `Successfully deleted code ${code.code}.`);
                                                    return reply(token_response);
                                                }, (err) => {
                                                    request.log(['oauth2-token-error'], `Error deleting code ${code.code}: ${err}.`);
                                                    return reply(Boom.internal());
                                                });
                                        }, (err) => {
                                            request.log(['oauth2-token-error'], `Error persisting token ${token_response}: ${err}.`);
                                            return reply(Boom.internal());
                                        });
                                }, (err) => {
                                    request.log(['oauth2-token-error'], `Error looking up existing token for client ID ${client_id}: ${err}.`);
                                    return reply(Boom.internal());
                                });
                        }

                    }, (err) => {
                        request.log(['oauth2-token-error'], `Error retrieving code ${codeValue}: ${err}.`);
                        return reply(Boom.internal());
                    });

            } else if (grant_type === 'client_credentials') {
                // TODO: add support for string token
                const token_response = TokenUtils.generateOAuthToken(null, client.client_id);
                request.log(['oauth2-token'], `Issuing client credentials token: ${JSON.stringify(token_response)}.`);
                return reply(token_response);
            } else if (grant_type === 'refresh_token') {
                //TODO: clean up code
                const refresh_token = request.payload.refresh_token;
                Models
                    .findTokenByRefresh(refresh_token)
                    .then((token) => {
                        if (!token) {
                            request.log(['oauth2-token-error'], `No matching refresh token ${refresh_token}.`);
                            return reply(Boom.unauthorized('invalid_grant'));
                        }
                        request.log(['oauth2-token'], `Found matching refresh token ${refresh_token}.`);
                        if (client_id !== token.client_id) {
                            request.log(['oauth2-token-error'], `Mismatched client ID ${client_id}. Deleting the token for security reasons.`);
                            Models
                                .deleteToken(token._id)
                                .then((result) => {
                                    request.log(['oauth2-token'], `Successfully deleting token ${token.access_token}: ${result}.`);
                                    return reply(Boom.unauthorized('invalid_grant'));
                                }, (err) => {
                                    request.log(['oauth2-token-error'], `Error deleting token ${token.access_token}: ${err}.`);
                                    return reply(Boom.internal());
                                });
                        }
                        request.log(['oauth2-token'], `Refreshing token ${token.access_token}.`);
                        const access_token = TokenUtils.generateTokenString();
                        token.access_token = access_token;
                        let ttl = new Date();
                        ttl.setDate(ttl.getDate() + 1);
                        token.ttl = ttl;
                        Models
                            .saveToken(token)
                            .then((token) => {
                                const token_response = { access_token: access_token, token_type: 'Bearer', state: token.state, refresh_token: token.refresh_token };
                                if (token.scope) {
                                    token_response.scope = token.scope;
                                }
                                return reply(token_response);
                            }, (err) => {
                                request.log(['oauth2-token-error'], `Error persisting new access token ${token.access_token}: ${err}.`);
                                return reply(Boom.internal());
                            });
                    }, (err) => {
                        console.log(err);
                    })

            } else {
                // TODO: support other grant types
                request.log(['oauth2-token-error'], `Unknown grant type ${grant_type}.`);
                reply(Boom.badRequest('invalid_grant'));
            }
        }, (err) => {
            reply(Boom.internal(`An error occurred: ${err.message}`));
        });
};