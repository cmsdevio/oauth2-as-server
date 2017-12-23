/* eslint-disable no-param-reassign */
const Glue = require('glue');

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
            exp: 315576000 // 10 years in seconds
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
