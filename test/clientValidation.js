/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
const { expect } = require('chai');
const Glue = require('glue');
const Randomstring = require('randomstring');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;

const Manifest = require('./resources/serverConfig');
const Options = require('./resources/oauthOptions');

// *************************************************
// Utility functions and variables
// *************************************************
let server;

const init = async () => {
    try {
        server = await Glue.compose(Manifest(9006), { relativeTo: `${ __dirname }/..` });

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
describe('Client Validation', () => {
    before(async () => {
        await init();
    });

    it('should display approval view for a valid client, and retain randomly generated state', async () => {
        const state = Randomstring.generate();
        const res = await server.inject({
            method: 'GET',
            url: `/oauth2/authorize?client_id=v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDfWVkUYkOgErV8AEf5qDU&redirect_uri=http://localhost:1234/dummy&response_type=code&state=${ state }`,
            credentials: { user: 'test' },
            validate: false
        });
        // console.log(res.result);
        expect(res.statusCode).to.equal(200);
        expect(res.request.query).to.deep.equal({
            client_id: 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDfWVkUYkOgErV8AEf5qDU',
            redirect_uri: 'http://localhost:1234/dummy',
            response_type: 'code',
            state
        });
        const dom = new JSDOM(res.result);
        expect(dom.window.document.querySelector('form').querySelector('p').innerHTML)
            .to.have.string('v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDfWVkUYkOgErV8AEf5qDU');
    });

    it('should reject invalid scope', async () => {
        const state = Randomstring.generate();
        const redirectUri = 'http://localhost:1234/dummy';
        const scope = 'foo bar';
        const errorMessage = 'Invalid scope(s) requested: foo,bar';
        const res = await server.inject({
            method: 'GET',
            url: `/oauth2/authorize?client_id=v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDfWVkUYkOgErV8AEf5qDU&redirect_uri=${ redirectUri }&response_type=code&scope=${ scope }&state=${ state }`,
            credentials: { user: 'test' },
            validate: false
        });

        expect(res.statusCode).to.equal(302);
        expect(res.headers.location).to.equal(`${ redirectUri }?error=${ encodeURIComponent(errorMessage) }`);
    });

    it('should reject an invalid redirect URI, and redirect with the error to the saved URI', async () => {
        const state = Randomstring.generate();
        const incorrectRedirectUri = 'http://localhost:4567/incorrect';
        const correctRedirectUri = 'http://localhost:1234/dummy';
        const errorMessage = `Invalid redirect URI ${ incorrectRedirectUri }`;
        const res = await server.inject({
            method: 'GET',
            url: `/oauth2/authorize?client_id=v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDfWVkUYkOgErV8AEf5qDU&redirect_uri=${ incorrectRedirectUri }&response_type=code&state=${ state }`,
            credentials: { user: 'test' },
            validate: false
        });

        expect(res.statusCode).to.equal(302);
        expect(res.headers.location).to.equal(`${ correctRedirectUri }?error=${ encodeURIComponent(errorMessage) }`);
        console.log(res.headers.location);
    });

    after(async () => {
        await server.stop();
        console.log('Server stopped.');
    });
});
