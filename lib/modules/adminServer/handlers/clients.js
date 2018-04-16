/**
 * Crafted in Erebor by thorin on 2018-04-16
 */
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
module.exports.getClients = () => {

};
