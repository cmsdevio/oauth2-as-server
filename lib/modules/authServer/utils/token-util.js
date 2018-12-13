const Randomstring = require('randomstring');
const Base64url = require('base64url');
const Jose = require('jsrsasign');

const Errors = require('./errors-utils');

module.exports.generateTokenString = (length = 25) =>
    Randomstring.generate(length);

/**
 * Generate an OAuth 2.0 token. Default to JWT signed, bearer token
 * @param {String} code - optional OAuth code for authorization grant type
 * @param {String} clientId - subject of the token
 * @param {String} email - subject of the token
 * @param {Object} options - configuration options
 * @param {String} refreshToken - refresh token to obtain new token
 * @param {String} tokenType - type of token generated. Default to jwt_signed
 * @param {String} tokenAuth - default to Bearer
 * @returns {{access_token: *, token_type: string}} - JWT token
 */
module.exports.generateOAuthToken = (
    code,
    clientId,
    email,
    options,
    refreshToken,
    tokenType = options.jwt.defaultTokenType,
    tokenAuth = options.jwt.defaultTokenAuth
) => {
    let accessToken;
    let ttl;
    // Validate JWT token type

    // JWT
    const header = { typ: 'JWT', alg: 'HS256' };
    const jtiValue = this.generateTokenString();
    const subject = (typeof clientId !== 'undefined') ? clientId : email;
    const payload = {
        iss: options.jwt.issuer,
        sub: subject,
        aud: options.jwt.protectedResource,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + options.jwt.exp,
        jti: jtiValue
    };

    switch (tokenType) {
    case 'jwt_signed':
        accessToken = Jose.jws.JWS.sign(
            header.alg,
            JSON.stringify(header),
            JSON.stringify(payload),
            Buffer.from(options.jwt.secretKey).toString('hex')
        );
        break;
    case 'jwt_unsigned':
        accessToken = `${ Base64url.encode(JSON.stringify(header)) }.${ Base64url.encode(JSON.stringify(payload)) }.`;
        break;
    case 'random_str':
        accessToken = this.generateTokenString();
        ttl = new Date();
        ttl.setDate(ttl.getDate() + 1);
        break;
    default:
        break;
    }

    const tokenResponse = {
        access_token: accessToken,
        token_type: tokenAuth,
        client_id: clientId
    };

    if (refreshToken) {
        tokenResponse.refresh_token = refreshToken;
    }
    if (ttl) {
        tokenResponse.ttl = ttl;
    }
    if (tokenType === 'random_str') {
        tokenResponse.client_id = clientId;
    }
    if (code && code.state) {
        tokenResponse.state = code.state;
    }

    return tokenResponse;
};

/**
 * Validates the refresh token.
 * @param {String} refreshToken - authorization server's code
 * @param {String} submittedValue - code sent by the client
 * @param {String} submittedClientId - client ID sent in the Authorization header
 * @returns {undefined}
 */
module.exports.validateRefreshToken = (refreshToken, submittedValue, submittedClientId) => {
    const today = new Date();
    if (!refreshToken) {
        throw new Errors.InvalidRefreshTokenError(`No matching token found for value: ${ submittedValue }.`);
    } else if (refreshToken.client_id !== submittedClientId) {
        throw new Errors.InvalidRefreshTokenError(`Mis-matching client ID. Got ${ submittedClientId }, expected ${ refreshToken.client_id }.`);
    } else if (refreshToken.ttl < today) {
        throw new Errors.InvalidRefreshTokenError(`Refresh token ${ submittedValue } expired on ${ refreshToken.ttl }.`);
    }
};
