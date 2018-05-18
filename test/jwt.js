/* eslint-disable no-multi-assign,no-param-reassign */
const { expect } = require('chai');
const Glue = require('glue');
const qs = require('qs');
const querystring = require('querystring');

const OAuthUtils = require('../lib/modules/authServer/utils/oauth-util');
const Manifest = require('./resources/serverConfig');
const Options = require('./resources/oauthOptions');

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
        server = await Glue.compose(Manifest(9005), { relativeTo: `${ __dirname }/..` });

        server.app.oauthOptions = Options;

        await server.start();

        console.log(`Test server running at: ${ server.info.uri }`);
    } catch (error) {
        console.error(error);
    }
};

// *************************************************
// TESTING SUITE
// *************************************************
describe.skip('JWT Token', () => {
    before(async () => {
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

    after(async () => {
        await server.stop();
        console.log('Server stopped.');
    });
});
