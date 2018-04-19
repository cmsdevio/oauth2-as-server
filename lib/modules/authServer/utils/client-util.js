/* eslint-disable consistent-return */
const _ = require('lodash');
const InvalidClientError = require('./errors-utils');

module.exports.isClientValid = (client, redirectUri, clientId, clientSecret, grantType) => {
    if (!client) {
        console.error(`Unknown client ID ${ clientId }.`);
        return false;
    } else if (!client.isActive) {
        console.error(`Client ID ${ client.client_id } is inactive.`);
        return false;
    // } else if (redirectUri.every(uri => client.redirect_uris.includes(uri))) {
    //     console.error(`Invalid redirect URI ${ redirectUri }.`);
    //     return false;
    } else if (redirectUri && redirectUri !== client.redirect_uri) {
        console.error(`Invalid redirect URI ${ redirectUri }.`);
        return false;
    } else if (clientSecret && clientSecret !== client.client_secret) {
        console.error(`Invalid client secret for ID ${ client.client_id }.`);
    } else if (grantType && client.grant_types.indexOf(grantType) === -1) {
        console.error(`Invalid grant type ${ grantType }.`);
        return false;
    } else {
        return true;
    }
};

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
        } else if (redirectUri && redirectUri !== client.redirect_uri) {
            throw new InvalidClientError(`Invalid redirect URI ${ redirectUri }`, client.client_id);
        } else if (clientSecret && clientSecret !== client.client_secret) {
            throw new InvalidClientError('Invalid client secret', client.client_id);
        } else if (grantType && client.grant_types.indexOf(grantType) === -1) {
            throw new InvalidClientError(`Invalid grant type ${ grantType }`, client.client_id);
        } else if (requestScopesArray) {
            const clientScopesArray = client.scope && client.scope.length > 0 ? client.scope.split(' ') : undefined;
            if (_.difference(requestScopesArray, clientScopesArray).length <= 0) {
                throw new InvalidClientError(`Invalid scope(s) requested: ${ requestScopesArray }`, client.client_id);
            }
        }
    };
