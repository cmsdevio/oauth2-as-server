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
describe('Token', () => {
    before(async () => {
        await init();
    });

    it('should generate a JWT token for Client Credentials grant type', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(tokenReqData),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
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

    it('should only accept token string for client ID passed in headers', async () => {
        // Added "{" in string
        const clientId = '9WBlEWnkLSwkcsTXI97bHf{x5joxleogWyKfGKni325Fewq10I';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(tokenReqData),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(400);
    });

    it('should only accept token string for client ID passed in the payload', async () => {
        // Added "{" in string
        const clientId = '9WBlEWnkLSwkcsTXI97bHf{x5joxleogWyKfGKni325Fewq10I';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: {
                ...tokenReqData,
                client_id: clientId,
                client_secret: clientSecret
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(400);
    });

    it('should only accept token string for client secret passed in headers', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I';
        const clientSecret = '{"gt": ""}';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(tokenReqData),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(400);
    });

    it('should only accept token string for client secret passed in the payload', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I';
        const clientSecret = '{"gt": ""}';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: {
                ...tokenReqData,
                client_id: clientId,
                client_secret: clientSecret
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(400);
    });

    it('should accept Basic Auth credentials in the payload', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: {
                ...tokenReqData,
                client_id: clientId,
                client_secret: clientSecret
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(200);
        expect(JSON.parse(res.payload).token_type).to.equal('Bearer');
        expect(JSON.parse(res.payload).client_id).to.equal(clientId);
    });

    it('should throw an error when receiving a request for a grant type not registered for a client', async () => {
        const clientId = '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: {
                ...tokenReqData,
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(403);
    });

    it.skip('should generate a refresh_token for a client with appropriate grant types', async () => {
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const data = {
            grant_type: 'authorization_code',
            redirect_uri: 'http://localhost:1234/dummy'
        };
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(200);
    });

    it('should reject a client with a missing code for auth code grant type', async () => {
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const data = {
            grant_type: 'authorization_code',
            redirect_uri: 'http://localhost:1234/dummy'
        };
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(403);
    });

    it('should reject a client with an incorrect code for auth code grant type', async () => {
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const data = {
            grant_type: 'authorization_code',
            code: 'gsdg86HDWSsgh6547Gsdfss34',
            redirect_uri: 'http://localhost:1234/dummy'
        };
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(403);
    });

    it('should reject a client with an expired code for auth code grant type', async () => {
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const data = {
            grant_type: 'authorization_code',
            code: 'HSDdg678ggrRrehg557DFSGEG',
            redirect_uri: 'http://localhost:1234/dummy'
        };
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(403);
    });

    it.skip('should generate a token for a valid code for the auth grant type', async () => {
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const clientSecret = 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4';
        const data = {
            grant_type: 'authorization_code',
            code: 'Fie345ffEE456hgDFDvp02WE6',
            redirect_uri: 'http://localhost:1234/dummy'
        };
        const request = {
            method: 'POST',
            url: '/oauth2/token',
            payload: qs.stringify(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${ OAuthUtils.encodeClientCredentials(clientId, clientSecret) }`
            },
            validate: true
        };

        const res = await server.inject(request);

        expect(res.statusCode).to.equal(403);
    });

    after(async () => {
        await server.stop();
        console.log('Server stopped.');
    });
});
