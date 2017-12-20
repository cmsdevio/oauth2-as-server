/* eslint-disable no-multi-assign */
const expect = require('chai').expect;
const Lab = require('lab');
const Glue = require('glue');

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
        },
        {
            port: process.env.PORT_ADMIN || 9007,
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
// TESTING SUITE
// *************************************************
suite('Dynamic Client Registration', () => {
    beforeEach(() => {
        Glue.compose(Manifest, options, (err, srv) => {
            if (err) {
                throw err;
            }
            server = srv;
        });
    });

    test('works', () => {
        expect(10).to.equal(10);
    });
});
