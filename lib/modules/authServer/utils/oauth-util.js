/* eslint-disable require-jsdoc */
const querystring = require('querystring');
const Errors = require('./errors-utils');

const decodeClientCredentials = (auth) => {
    const clientCredentials = Buffer.from(auth.slice('basic '.length), 'base64').toString().split(':');
    const clientId = querystring.unescape(clientCredentials[0]);
    const clientSecret = querystring.unescape(clientCredentials[1]);
    return { id: clientId, secret: clientSecret };
};

module.exports.encodeClientCredentials = (clientId, clientSecret) =>
    Buffer.from(`${ querystring.escape(clientId) }:${ querystring.escape(clientSecret) }`).toString('base64');

module.exports.extractHttpBasicCredentials = (authHeader, payload) => {
    let clientId;
    let clientSecret;
    if (authHeader) {
        console.log('Found authorization header for client credentials.');
        const clientCredentials = decodeClientCredentials(authHeader);
        clientId = clientCredentials.id;
        clientSecret = clientCredentials.secret;
    }

    // Check POST body
    if (payload.client_id) {
        console.log('Found POST body for client credentials.');
        if (clientId) {
            // Client already authenticated
            throw new Errors.DuplicateCredentialsError('Client attempted to authenticate with multiple methods.');
        }
        clientId = payload.client_id;
        clientSecret = payload.client_secret;
    }

    if (!clientId) {
        throw new Errors.MissingBasicAuthCredentialsError();
    }

    return { clientId, clientSecret };
};

module.exports.validateDcrGrantResponseTypes = (dcrGrantTypesArray, dcrResponseTypesArray) => {
    if (false) {
        throw new Errors.InvalidClientError('Invalid grant_types/response_types combination.');
    }
};
