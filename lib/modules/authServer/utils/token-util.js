const Randomstring = require('randomstring');
// REMOVE
const Axios = require('axios');
const https = require('https');
// END REMOVE
const Base64url = require('base64url');
const Jose = require('jsrsasign');

// REMOVE
// eslint-disable-next-line no-unused-vars
const axios = Axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});
// END REMOVE

module.exports.generateTokenString = (length = 25) =>
    Randomstring.generate(length);

module.exports.generateOAuthToken = (code, clientId, options, tokenType = 'jwt_signed', tokenAuth = 'Bearer') => {
    let accessToken;
    let refreshToken;
    let ttl;
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
        token_type: tokenAuth
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

    // *********************************
    // TO REMOVE FROM SERVER
    // *********************************
    // TODO: create account in QuizApp
    /* axios.post('https://localhost:8443/api/account', {idtn1: clientId, idtn2: jtiValue})
        .then(response => {
            console.log(response.payload);
            return tokenResponse;
        })
        .catch(err => {
            console.error(err);
            return tokenResponse;
        }); */

    // *********************************
    // END REMOVE
    // *********************************
    return tokenResponse;
};
