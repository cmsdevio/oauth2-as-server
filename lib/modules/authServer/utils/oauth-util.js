const _ = require('lodash');
const querystring = require('querystring');

module.exports.isScopeValid = (reqScope, authScope) => {
    return _.difference(reqScope, authScope).length <= 0;
};

module.exports.determineScope = (reqScope, payload) => {
    const scope = [];
    reqScope.forEach(aScope => {
        if (payload[aScope]) {
            scope.push(aScope);
        }
    });
    return scope.length > 0 ? scope.join('') : '';
};

module.exports.extractHttpBasicCredentials = (authHeader, payload) => {
    // TODO: support other auth methods than HTTP Basic
    // For example, private_key_jwt, etc....
    // Methods will be defined during dynamic client registration
    let client_id, client_secret;
    if (authHeader) {
        console.log(`Found authorization header for client credentials.`);
        const clientCredentials = decodeClientCredentials(authHeader);
        client_id = clientCredentials.id;
        client_secret = clientCredentials.secret;
    }

    // Check POST body
    if (payload.client_id) {
        console.log(`Found POST body for client credentials.`);
        if (client_id) {
            // Client already authenticated
            throw new DuplicateCredentialsError('Client attempted to authenticate with multiple methods.');
        }
        client_id = payload.client_id;
        client_secret = payload.client_secret;
    }

    return {client_id: client_id, client_secret: client_secret};
};

const decodeClientCredentials = function(auth) {
    const clientCredentials = new Buffer(auth.slice('basic '.length), 'base64').toString().split(':');
    const clientId = querystring.unescape(clientCredentials[0]);
    const clientSecret = querystring.unescape(clientCredentials[1]);
    return { id: clientId, secret: clientSecret };
};

// TODO: create custom errors
class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

class DuplicateCredentialsError extends ExtendableError {}