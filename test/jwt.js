/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
const Glue = require('glue');
const qs = require('qs');
const Good = require('good');
const querystring = require('querystring');
const OAuthUtils = require('../lib/modules/authServer/utils/oauth-util');

// *************************************************
// GLU CONFIG
// *************************************************
const Manifest = {
    server: {
        port: process.env.PORT || 9005,
        routes: { cors: true }
    },
    register: {
        plugins: [
            {
                plugin: Good,
                options: {
                    reporters: {
                        console: [
                            {
                                module: 'good-squeeze',
                                name: 'Squeeze',
                                args: [ {
                                    log: '*',
                                    request: '*',
                                    response: [ 'oauth2-*', 'admin-*' ]
                                } ]
                            },
                            {
                                module: 'good-console'
                            },
                            'stdout'
                        ]
                    }
                }
            },
            {
                plugin: 'vision'
            },
            {
                plugin: 'inert'
            },
            {
                plugin: 'lout'
            },
            {
                plugin: './lib/modules/mocks/database/index'
            },
            {
                plugin: 'hapi-auth-cookie'
            },
            {
                plugin: 'hapi-auth-bearer-token'
            },
            {
                plugin: './lib/modules/caching/index'
            },
            {
                plugin: './lib/modules/authServer/index'
            }
        ]
    }
};
const options = { relativeTo: `${ __dirname }/..` };

// *************************************************
// Utility functions and variables
// *************************************************
let server;
const tokenReqData = {
    grant_type: 'client_credentials',
    redirect_uri: 'http://localhost:1234/dummy'
};

const init = async () => {
    try {
        server = await Glue.compose(Manifest, options);

        server.app.oauthOptions = {
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
                defaultGrantType: 'authorization_code',
                defaultResponseType: 'code',
                defaultTokenEndpointAuthMethod: 'client_secret_basic',
                clientSecretExpiration: 0
            }
        };

        await server.start();

        console.log(`Test server running at: ${ server.info.uri }`);
    } catch (error) {
        console.error(error);
    }
};

// *************************************************
// TESTING SUITE
// *************************************************
describe('JWT Token', () => {
    beforeEach(async () => {
        await init();
    });

    it('should generate a JWT token for Client Credentials grant type', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyK';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(tokenReqData),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            }
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(200);
        const tokenParts = JSON.parse(res.payload).access_token.split('.');
        expect(tokenParts.length).to.equal(3);
        const jwtbody =
        JSON.parse(querystring.unescape(Buffer.from(tokenParts[1], 'base64').toString()));
        expect(jwtbody.iss).to.equal('http://localhost:9007/');
        expect(jwtbody.aud).to.equal('http://localhost:4000/');
    });
});
