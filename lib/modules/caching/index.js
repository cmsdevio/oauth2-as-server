/* eslint-disable no-param-reassign */
const meta = require('./package');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');

exports.register = (server, options, next) => {
    // **************************************
    //            CATBOX CACHING
    // **************************************
    const reqCacheOptions = {
        expiresIn: 120000,
        segment: 'requests'
    };
    const reqCacheClient = new Catbox.Client(CatboxMemory, reqCacheOptions);

    reqCacheClient.start((err) => {
        if (err) {
            server.log([ 'caching-catbox-error' ], `Error starting Catbox client: ${ err }.`);
        }
        server.log([ 'caching-catbox' ], 'Catbox req client successfully started.');
        server.app.req_caching_catbox_memory = reqCacheClient;
    });

    const sessionCacheOptions = {
        expiresIn: 60 * 60 * 1000,
        segment: 'sessions'
    };
    const sessionCacheClient = new Catbox.Client(CatboxMemory, sessionCacheOptions);

    sessionCacheClient.start((err) => {
        if (err) {
            server.log([ 'caching-catbox-error' ], `Error starting Catbox client: ${ err }.`);
        }
        server.log([ 'caching-catbox' ], 'Catbox session client successfully started.');
        server.app.session_caching_catbox_memory = sessionCacheClient;
    });

    next();
};

exports.register.attributes = {
    pkg: meta
};
