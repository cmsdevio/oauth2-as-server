/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
const Lab = require('lab');
const Glue = require('glue');
const qs = require('qs');
const querystring = require('querystring');
const OAuthUtils = require('../lib/modules/authServer/utils/oauth-util');

// *************************************************
// GLU CONFIG
// *************************************************
const Manifest = {
    server: {},
    connections: [
        {
            port: process.env.PORT || 9005,
            labels: [ 'oauth2' ],
            routes: { cors: true }
        }
    ],
    registrations: [
        {
            plugin: {
                register: 'good',
                options: {
                    reporters: {
                        console: [
                            {
                                module: 'good-squeeze',
                                name: 'Squeeze',
                                args: [ {
                                    log: '*',
                                    request: '*',
                                    response: [ 'oauth2-*' ]
                                } ]
                            },
                            {
                                module: 'good-console'
                            },
                            'stdout'
                        ]
                    }
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
            plugin: 'tv'
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
            plugin: {
                register: './lib/modules/caching/index',
                options: {}
            }
        },
        {
            plugin: './lib/modules/authServer/index',
            options: {
                select: [ 'oauth2' ],
                routes: {
                    prefix: '/oauth2'
                }
            }
        }
    ]
};
const options = { relativeTo: `${ __dirname }/..` };

// *************************************************
// LAB CONFIG
// *************************************************
const lab = exports.lab = Lab.script();
const { suite, test } = lab;
const beforeEach = lab.before;
let server;

// *************************************************
// Utility functions and variables
// *************************************************
const tokenReqData = {
    grant_type: 'client_credentials',
    redirect_uri: 'http://localhost:1234/dummy'
};

// *************************************************
// TESTING SUITE
// *************************************************
suite('JWT Token', () => {
    beforeEach(() => {
        Glue.compose(Manifest, options, (err, srv) => {
            if (err) {
                throw err;
            }
            server = srv;
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
        });
    });

    test('should generate a JWT token for Client Credentials grant type', () => {
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

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(200);
            // const tokenParts = res.payload.access_token.split('.');
            // expect(tokenParts.length).to.equal(3);
            // const jwtbody =
            // JSON.parse(querystring.unescape(Buffer.from(tokenParts[1], 'base64').toString()));
            // console.log(jwtbody);
        });
    });
});
