/**
 * Crafted in Erebor by thorin on 2018-06-07
 */
const { expect } = require('chai');

const Errors = require('../lib/modules/authServer/utils/errors-utils');

// *************************************************
// TESTING SUITE
// *************************************************
describe('Errors', () => {
    it('should instantiate an error properly', () => {
        expect(new Errors.MissingBasicAuthCredentialsError())
            .to.be.an.instanceof(Errors.MissingBasicAuthCredentialsError);
        expect(new Errors.DuplicateCredentialsError())
            .to.be.an.instanceof(Errors.DuplicateCredentialsError);
        expect(new Errors.InvalidClientError()).to.be.an.instanceof(Errors.InvalidClientError);
        expect(new Errors.InvalidCodeError()).to.be.an.instanceof(Errors.InvalidCodeError);
        expect(new Errors.RequestKeyCacheError()).to.be.an.instanceof(Errors.RequestKeyCacheError);
        expect(new Errors.InvalidRefreshTokenError())
            .to.be.an.instanceof(Errors.InvalidRefreshTokenError);
    });

    it('should instantiate an error with the proper attributes', () => {
        const customErrorMessage = 'This client is clearly invalid';
        const clientId = 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf';
        const invalidClientError = new Errors.InvalidClientError(customErrorMessage, clientId);
        expect(invalidClientError).to.be.an.instanceof(Errors.InvalidClientError);
        expect(invalidClientError.message).to.equal(customErrorMessage);
        expect(invalidClientError).to.have.own.property('message', customErrorMessage);
        expect(invalidClientError).to.have.own.property('clientId', clientId);
    });
});
