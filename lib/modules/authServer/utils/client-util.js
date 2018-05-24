/* eslint-disable consistent-return */
const _ = require('lodash');
const InvalidClientError = require('./errors-utils');

/**
 * Validates a client requesting a token
 * @param {Object} client - OAuth client
 * @param {uri} redirectUri - for now a single URI, must match at least one in the client definition
 * @param {String} clientId - client ID sent as part credentials in the token request
 * @param {String} clientSecret - client secret sent as part credentials in the token request
 * @param {String} grantType - optional grant type
 * @param {Array} requestScopesArray - optional array generated from space separated
 * scope string(s). Must be a subset of client-defined scopes
 * @throws InvalidClientError - if client not valid
 * @returns {undefined}
 */
module.exports.validateClient =
    (client, redirectUri, clientId, clientSecret, grantType, requestScopesArray) => {
        if (!client) {
            throw new InvalidClientError(`Unknown client ID ${ clientId }`);
        } else if (!client.isActive) {
            throw new InvalidClientError('Client is inactive', client.client_id);
            // } else if (redirectUri.every(uri => client.redirect_uris.includes(uri))) {
            //     console.error(`Invalid redirect URI ${ redirectUri }.`);
            //     return false;
        } else if (redirectUri && !client.redirect_uris.includes(redirectUri)) {
            throw new InvalidClientError(`Invalid redirect URI ${ redirectUri }`, client.client_id);
        } else if (clientSecret && clientSecret !== client.client_secret) {
            throw new InvalidClientError('Invalid client secret', client.client_id);
        } else if (grantType && !client.grant_types.includes(grantType)) {
            throw new InvalidClientError(`Invalid grant type ${ grantType }`, client.client_id);
        } else if (requestScopesArray) {
            const clientScopesArray = client.scopes && Array.isArray(client.scopes) ?
                client.scopes : [];
            if (_.difference(requestScopesArray, clientScopesArray).length > 0) {
                throw new InvalidClientError(`Invalid scope(s) requested: ${ requestScopesArray }`, client.client_id);
            }
        }
    };

/**
 * Ensures that approved scopes are a subset of submitted scopes
 * @param {Array} requestedScopesArray - list of scopes submitted for approval by the client
 * @param {Array} queryParameters - approved scopes are submitted as such: 'foo=on&bar=on'
 * @returns {Array} - list of scopes submitted and approved
 */
module.exports.checkApprovedScopes = (requestedScopesArray, queryParameters) => {
    const scopes = [];
    if (requestedScopesArray) {
        requestedScopesArray.forEach((aScope) => {
            if (queryParameters[aScope]) {
                scopes.push(aScope);
            }
        });
    }
    return scopes;
};
