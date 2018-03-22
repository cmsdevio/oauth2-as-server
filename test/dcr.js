/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
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
// Utility functions and variables
// *************************************************
let server;
const KEY_BEARER_TOKEN = '$2a$10$2hdf7zFYV.4RUgKxsmRtKuAA/H9dqK0ujIGOdbpm.ENah4iJaEDlm';
const dcrReqData = {
    client_name: 'restlet_client_5328',
    redirect_uris: [ 'http://localhost:1234/dummy' ],
    grant_types: [ 'client_credentials' ],
    response_type: 'token',
    token_endpoint_auth_method: 'client_secret_basic'
};
const expectedPayload = {
    client_name: 'restlet_client_5327',
    redirect_uris: [ 'http://localhost:1234/dummy' ],
    grant_types: [ 'client_credentials' ],
    response_type: 'token',
    token_endpoint_auth_method: 'client_secret_basic',
    client_id: '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyK',
    client_secret: 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4',
    client_id_created_at: 1513791723,
    client_secret_expires_at: 0,
    isActive: true
};
// *************************************************
// TESTING SUITE
// *************************************************
describe('Dynamic Client Registration', () => {
    beforeEach((done) => {
        Glue.compose(Manifest, options, (err, srv) => {
            if (err) {
                throw err;
            }
            server = srv;
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
            done();
        });
    });

    it('should dynamically register a client', (done) => {
        const request = {
            method: 'POST',
            url: '/oauth2/register',
            payload: dcrReqData,
            headers: {
                Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            }
        };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(201);
            expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
            done();
        });
    });

    it('should reject invalid grant/response type combinations', () => {
        const request = {
            method: 'POST',
            url: '/oauth2/register',
            payload: { ...dcrReqData, response_type: 'code' },
            headers: {
                Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            }
        };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(400);
        });
    });

    it('should populate the DCR client with default values', () => {
        const dcrReqDataNoTokenEndpointAuth = {
            client_name: 'restlet_client_5328',
            redirect_uris: [ 'http://localhost:1234/dummy' ]
        };
        const request = {
            method: 'POST',
            url: '/oauth2/register',
            payload: dcrReqDataNoTokenEndpointAuth,
            headers: {
                Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            }
        };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(201);
            expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
        });
    });
});
