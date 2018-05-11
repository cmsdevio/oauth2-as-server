const Randomstring = require('randomstring');
const Base64url = require('base64url');
const Jose = require('jsrsasign');

module.exports.generateTokenString = (length = 25) =>
    Randomstring.generate(length);

/**
 * Generate an OAuth 2.0 token. Default to JWT signed, bearer token
 * @param {String} code - optional OAuth code for authorization grant type
 * @param {String} clientId - subject of the token
 * @param {Object} options - configuration options
 * @param {String} tokenType - type of token generated. Default to jwt_signed
 * @param {String} tokenAuth - default to Bearer
 * @returns {{access_token: *, token_type: string}} - JWT token
 */
module.exports.generateOAuthToken = (
    code,
    clientId,
    options,
    tokenType = options.jwt.defaultTokenType,
    tokenAuth = options.jwt.defaultTokenAuth
) => {
    let accessToken;
    let refreshToken;
    let ttl;
    // Validate JWT token type

    // JWT
    const header = { typ: 'JWT', alg: 'HS256' };
    const jtiValue = this.generateTokenString();
    const payload = {
        iss: options.jwt.issuer,
        sub: clientId,
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
        refreshToken = this.generateTokenString();
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
