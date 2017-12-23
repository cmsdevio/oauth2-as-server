/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
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
const dcrReqData = {
    client_name: 'restlet_client_5328',
    redirect_uris: [ 'http://localhost:1234/dummy' ],
    // grant_types: [ 'client_credentials' ],
    response_type: 'token',
    token_endpoint_auth_method: 'client_secret_basic'
};

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

    test('should dynamically register a client', () => {
        const expectedPayload = {
            client_name: 'restlet_client_5328',
            redirect_uris: [ 'http://localhost:1234/dummy' ],
            grant_types: [ 'client_credentials' ],
            response_type: 'token',
            token_endpoint_auth_method: 'client_secret_basic',
            client_id: 'fq56e5Ci1iHYSOxh6tveFpKEaMta5AG4WZC',
            client_secret: 'CMQuAx3ggYhy7fT4umnzfZvNf16hlFgGvPmoirENIdmMNR3rRf',
            client_id_created_at: 1513791878,
            client_secret_expires_at: 0
        };
        const request = { method: 'POST', url: '/oauth2/register', payload: dcrReqData };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(200);
            expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
        });
    });

    test('should reject invalid grant/response type combinations', () => {
        const request = { method: 'POST', url: '/oauth2/register', payload: { ...dcrReqData, response_type: 'code' } };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(400);
        });
    });

    /*test.skip('should populate the DCR client with default value for token endpoint', () => {
        const expectedPayload = {
            client_name: 'restlet_client_5328',
            redirect_uris: [ 'http://localhost:1234/dummy' ],
            grant_types: [ 'client_credentials' ],
            response_type: 'token',
            token_endpoint_auth_method: 'client_secret_basic',
            client_id: 'fq56e5Ci1iHYSOxh6tveFpKEaMta5AG4WZC',
            client_secret: 'CMQuAx3ggYhy7fT4umnzfZvNf16hlFgGvPmoirENIdmMNR3rRf',
            client_id_created_at: 1513791878,
            client_secret_expires_at: 0
        };
        const dcrReqDataNoTokenEndpointAuth = {
            client_name: 'restlet_client_5328',
            redirect_uris: [ 'http://localhost:1234/dummy' ],
            grant_types: [ 'client_credentials' ],
            response_type: 'token'
        };
        const request = { method: 'POST', url: '/oauth2/register', payload: dcrReqDataNoTokenEndpointAuth };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(200);
            expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
        });
    });*/
});
