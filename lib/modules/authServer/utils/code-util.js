const Errors = require('./errors-utils');

/**
 * Validates the code used to obtain a token.
 * Applies to the Authorization Code grant type.
 * @param {String} code - authorization server's code
 * @param {String} submittedValue - code sent by the client
 * @param {String} submittedClientId - client ID sent in the Authorization header
 * @returns {undefined}
 */
module.exports.validateCode = (code, submittedValue, submittedClientId) => {
    const today = new Date();
    if (!code) {
        throw new Errors.InvalidCodeError(`No matching code found for value: ${ submittedValue }.`);
    } else if (code.client_id !== submittedClientId) {
        throw new Errors.InvalidCodeError(`Mis-matching client ID. Got ${ submittedClientId }, expected ${ code.client_id }.`);
    } else if (code.ttl < today) {
        throw new Errors.InvalidCodeError(`Code ${ code.code } expired on ${ code.ttl }.`);
    }
};
