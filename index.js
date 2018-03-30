/* eslint-disable no-param-reassign */
const Glue = require('glue');

const Manifest = {
    server: {},
    connections: [
        {
            port: process.env.PORT || 9005,
            labels: [ 'oauth2' ],
            routes: { cors: true }
        },
        {
            port: process.env.PORT_UI || 9007,
            labels: [ 'admin' ]
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
            plugin: './lib/modules/database/index'
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
        },
        {
            plugin: './lib/modules/adminServer/index',
            options: {
                select: [ 'admin' ],
                routes: {
                    prefix: '/admin'
                }
            }
        }
    ]
};

const options = { relativeTo: __dirname };

Glue.compose(Manifest, options, (err, server) => {
    if (err) {
        throw err;
    }

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

    server.start((error) => {
        if (error) {
            throw error;
        }
        console.log('Server started...');
    });
});
