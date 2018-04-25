/* eslint-disable require-jsdoc */
/**
 * Crafted in Erebor by thorin on 2017-12-30
 */
class ExtendableError extends Error {
    constructor(message, status) {
        // Calling parent constructor of base Error class
        super(message);
        // Saving class name in the property of our custom error as a shortcut
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            // Capturing stack trace, excluding constructor from it
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
        this.status = status || 500;
    }
}

module.exports = class DuplicateCredentialsError extends ExtendableError {
    constructor(message) {
        super(message || 'Duplicate credentials', 400);
    }
};

module.exports = class InvalidClientError extends ExtendableError {
    constructor(message, clientId) {
        super(message || 'Invalid client', 401);
        this.clientId = clientId || null;
    }
};
