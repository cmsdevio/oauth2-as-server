const Randomstring = require('randomstring');
// const Crypto = require('crypto');
const Base64url = require('base64url');
const Jose = require('jsrsasign');

//TODO: move to env vars or something
const sharedTokenSecret = 'OCW6s6K5yAtdLI2b/7GZpzWQNmxwmb5IF1bb1xv9WHQoBH/+Y9WBMyb9OSJfGvS+2Iza8g0U2oZhupVIjvJw4HVHIYZIGdcJJhvnrI0i3kRIB1HWAz0eh2myjFs7B5ZHM2vYBHxYdXUnEceg11RhClAc3+jLuCTkaDYbHwhZehHBIiTiLb1fSoF7x70tUAGrikChsfSKx7Kr+OKca7osk79e57jG67qG2hK0jevV/SCM/nOmw0HFke62GHM8HkY3nIQTWQ1p4o3VUta80C9ADU3Cs1DagUCyO/rYVD/WVgzv26YC8Ed8OIj3Rjby+OgJTGSL1SZKvuIVuIGObCAFHA==';

module.exports.generateTokenString = (length = 25) => {
    return Randomstring.generate(length);
};

module.exports.generateOAuthToken = (code, client_id, token_type = 'jwt_signed', token_auth = 'Bearer') => {
    let access_token, refresh_token, ttl;
    // JWT
    const header = {typ: 'JWT', alg: 'HS256'};
    const payload = {
        iss: 'http://localhost:9007/',
        sub: client_id,
        aud: 'http://localhost:8080/',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (5 * 60),
        jti: this.generateTokenString()
    };
    switch (token_type) {
        case 'jwt_signed':
            access_token = Jose.jws.JWS.sign(header.alg,
                JSON.stringify(header),
                JSON.stringify(payload),
                new Buffer(sharedTokenSecret).toString('hex'));
            break;
        case 'jwt_unsigned':
            access_token = `${Base64url.encode(JSON.stringify(header))}.${Base64url.encode(JSON.stringify(payload))}.`;
            break;
        case 'random_str':
            access_token = this.generateTokenString();
            refresh_token = this.generateTokenString();
            ttl = new Date();
            ttl.setDate(ttl.getDate() + 1);
    }

    const token_response = {
        access_token: access_token,
        token_type: token_auth
    };

    if (refresh_token) {
        token_response.refresh_token = refresh_token;
    }
    if (ttl) {
        token_response.ttl = ttl;
    }
    if (token_type === 'random_str') {
        token_response.client_id = client_id;
    }
    if (code && code.state) {
        token_response.state = code.state;
    }


    return token_response;
};