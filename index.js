/* eslint-disable no-param-reassign */
const Glue = require('glue');
const Good = require('good');

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
                plugin: './lib/modules/database/index'
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

const options = { relativeTo: __dirname };

const init = async () => {
    try {
        const server = await Glue.compose(Manifest, options);

        server.app.oauthOptions = {
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
                clientIdLength: 50,
                clientSecretLength: 100,
                defaultGrantTypes: [ 'authorization_code', 'refresh_token' ],
                defaultResponseTypes: [ 'code' ],
                defaultTokenEndpointAuthMethod: 'client_secret_basic',
                clientSecretExpiration: 0
            }
        };

        server.app.adminOptions = {
            sessionLength: 120000 // 2 minutes in milliseconds
        };

        await server.start();

        console.log(`Server running at: ${ server.info.uri }`);
    } catch (error) {
        console.error(error);
    }
};

init();

// Glue.compose(Manifest, options, (err, server) => {
//     if (err) {
//         throw err;
//     }
//

//
//     server.start((error) => {
//         if (error) {
//             throw error;
//         }
//         console.log('Server started...');
//     });
// });
