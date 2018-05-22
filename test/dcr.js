/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
const Glue = require('glue');

const Manifest = require('./resources/serverConfig');
const Options = require('./resources/oauthOptions');

// *************************************************
// Utility functions and variables
// *************************************************
let server;

const init = async () => {
    try {
        server = await Glue.compose(Manifest(9007), { relativeTo: `${ __dirname }/..` });

        server.app.oauthOptions = Options;

        await server.start();

        console.log(`Test server running at: ${ server.info.uri }`);
    } catch (error) {
        console.error(error);
    }
};

// const KEY_BEARER_TOKEN = 'OCW6s6K5yAtdLI2b/7GZpzWQNmxwmb5IF1bb1xv9WHQoBH/+Y9WBMyb9OSJfGvS+2Iza8g0U2oZhupVIjvJw4HVHIYZIGdcJJhvnrI0i3kRIB1HWAz0eh2myjFs7B5ZHM2vYBHxYdXUnEceg11RhClAc3+jLuCTkaDYbHwhZehHBIiTiLb1fSoF7x70tUAGrikChsfSKx7Kr+OKca7osk79e57jG67qG2hK0jevV/SCM/nOmw0HFke62GHM8HkY3nIQTWQ1p4o3VUta80C9ADU3Cs1DagUCyO/rYVD/WVgzv26YC8Ed8OIj3Rjby+OgJTGSL1SZKvuIVuIGObCAFHA==';
const dcrReqData = {
    client_name: 'restlet_client_5328',
    redirect_uri: 'http://localhost:1234/dummy',
    grant_type: 'client_credentials',
    response_type: 'token',
    token_endpoint_auth_method: 'client_secret_basic'
};

const expectedPayload = {
    client_name: 'restlet_client_5327',
    redirect_uri: 'http://localhost:1234/dummy',
    grant_type: 'client_credentials',
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
    before(async () => {
        await init();
    });

    it('should dynamically register a client', async () => {
        const request = {
            method: 'POST',
            url: '/oauth2/register',
            payload: dcrReqData
            // headers: {
            //     Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            // }
        };

        const res = await server.inject(request);
        expect(res.statusCode).to.equal(201);
        expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
    });

    it('should reject invalid grant/response type combinations', () => {
        const request = {
            method: 'POST',
            url: '/oauth2/register',
            payload: { ...dcrReqData, response_type: 'code' }
            // headers: {
            //     Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            // }
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
            payload: dcrReqDataNoTokenEndpointAuth
            // headers: {
            //     Authorization: `Bearer ${ KEY_BEARER_TOKEN }`
            // }
        };

        server.inject(request, (res) => {
            expect(res.statusCode).to.equal(201);
            expect(JSON.parse(res.payload)).to.deep.equal(expectedPayload);
        });
    });

    after(async () => {
        await server.stop();
        console.log('Server stopped.');
    });
});
