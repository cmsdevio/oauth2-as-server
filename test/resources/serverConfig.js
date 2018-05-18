/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
const Good = require('good');

module.exports = port => ({
    server: {
        port,
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
});
