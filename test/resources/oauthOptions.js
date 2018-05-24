/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
module.exports = {
    authGrantType: {
        codeTTL: 1, // days
        defaultResponseType: 'code'
    },
    jwt: {
        exp: 315576000, // 10 years in seconds
        secretKey: process.env.JWT_SECRET_KEY || 'OCW6s6K5yAtdLI2b/7GZpzWQNmxwmb5IF1bb1xv9WHQoBH/+Y9WBMyb9OSJfGvS+2Iza8g0U2oZhupVIjvJw4HVHIYZIGdcJJhvnrI0i3kRIB1HWAz0eh2myjFs7B5ZHM2vYBHxYdXUnEceg11RhClAc3+jLuCTkaDYbHwhZehHBIiTiLb1fSoF7x70tUAGrikChsfSKx7Kr+OKca7osk79e57jG67qG2hK0jevV/SCM/nOmw0HFke62GHM8HkY3nIQTWQ1p4o3VUta80C9ADU3Cs1DagUCyO/rYVD/WVgzv26YC8Ed8OIj3Rjby+OgJTGSL1SZKvuIVuIGObCAFHA==',
        issuer: process.env.JWT_ISSUER || 'http://localhost:9007/',
        protectedResource: process.env.PROTECTED_RESOURCE || 'http://localhost:4000/',
        defaultTokenType: 'jwt_signed',
        supportedTokenTypes: [ 'jwt_signed', 'jwt_unsigned', 'random_str' ],
        defaultTokenAuth: 'Bearer'
    },
    dcr: {
        clientIdLength: 35,
        clientSecretLength: 50,
        defaultGrantTypes: [ 'authorization_code', 'refresh_token' ],
        defaultResponseTypes: [ 'code' ],
        defaultTokenEndpointAuthMethod: 'client_secret_basic',
        clientSecretExpiration: 0
    }
};
