/* eslint-disable no-param-reassign */
const meta = require('./package');
const Catbox = require('catbox');
const CatboxMemory = require('catbox-memory');

exports.plugin = {
    register: async (server) => {
        // **************************************
        //            CATBOX CACHING
        // **************************************
        const reqCacheOptions = {
            expiresIn: 120000,
            segment: 'requests'
        };
        const reqCacheClient = new Catbox.Client(CatboxMemory, reqCacheOptions);

        try {
            await reqCacheClient.start();
            server.log([ 'caching-catbox' ], 'Catbox req client successfully started.');
            server.app.req_caching_catbox_memory = reqCacheClient;
        } catch (error) {
            server.log([ 'caching-catbox-error' ], `Error starting Catbox client: ${ error }.`);
        }

        const sessionCacheOptions = {
            expiresIn: 60 * 60 * 1000,
            segment: 'sessions'
        };
        const sessionCacheClient = new Catbox.Client(CatboxMemory, sessionCacheOptions);
        try {
            await sessionCacheClient.start();
            server.log([ 'caching-catbox' ], 'Catbox session client successfully started.');
            server.app.session_caching_catbox_memory = sessionCacheClient;
        } catch (error) {
            server.log([ 'caching-catbox-error' ], `Error starting Catbox client: ${ error }.`);
        }
    },
    pkg: meta
};
