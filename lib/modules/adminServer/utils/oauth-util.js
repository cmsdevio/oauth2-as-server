/* eslint-disable require-jsdoc */
const _ = require('lodash');
const querystring = require('querystring');
const DuplicateCredentialsError = require('./errors-utils');

const decodeClientCredentials = (auth) => {
    const clientCredentials = Buffer.from(auth.slice('basic '.length), 'base64').toString().split(':');
    const clientId = querystring.unescape(clientCredentials[0]);
    const clientSecret = querystring.unescape(clientCredentials[1]);
    return { id: clientId, secret: clientSecret };
};

module.exports.encodeClientCredentials = (clientId, clientSecret) =>
    Buffer.from(`${ querystring.escape(clientId) }:${ querystring.escape(clientSecret) }`).toString('base64');

module.exports.isScopeValid = (reqScope, authScope) =>
    _.difference(reqScope, authScope).length <= 0;

module.exports.determineScope = (reqScope, payload) => {
    const scope = [];
    if (!reqScope) {
        return '';
    }
    reqScope.forEach((aScope) => {
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
            throw new DuplicateCredentialsError('Client attempted to authenticate with multiple methods.');
        }
        clientId = payload.client_id;
        clientSecret = payload.client_secret;
    }

    return { clientId, clientSecret };
};

module.exports.validateDcrGrantResponseTypes = (dcrGrantTypeArray, dcrResponseType) => {
    const grantTypeIsValid = (!(dcrGrantTypeArray.includes('authorization_code') && dcrResponseType !== 'code'));
    const responseTypeIsValid = (!(dcrGrantTypeArray.includes('client_credentials') && dcrResponseType !== 'token'));
    return grantTypeIsValid && responseTypeIsValid;
};
