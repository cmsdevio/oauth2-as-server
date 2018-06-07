const Randomstring = require('randomstring');

const Errors = require('./errors-utils');

module.exports.setRequestKey = async (request) => {
    const reqCacheClient = request.server.app.req_caching_catbox_memory;
    const reqId = Randomstring.generate(12);
    const key = { id: reqId, segment: 'requests' };
    try {
        await reqCacheClient.set(key, request.query, 120000);
        request.log([ 'test-pre' ], `Successfully persisted request to cache with key ${ reqId }.`);
        return reqId;
    } catch (error) {
        request.log([ 'test-pre-error' ], `Error saving request to cache with key ${ reqId }.`);
        throw new Errors.RequestKeyCacheError();
    }
};

module.exports.checkRequestKey = async (request) => {
    const reqCacheClient = request.server.app.req_caching_catbox_memory;
    const { reqId } = request.payload;
    request.log([ 'test-pre' ], `Validating POST request with key ${ reqId }.`);
    const key = { id: reqId, segment: 'requests' };

    try {
        const cached = await reqCacheClient.get(key);
        if (cached) {
            const reqData = cached.item;
            request.log([ 'test-dcr' ], `Successfully retrieved item from cache with key ${ reqId }: ${ JSON.stringify(reqData) }.`);

            await reqCacheClient.drop(key);
            request.log([ 'test-pre' ], `Successfully dropped item from cache with key ${ reqId }.`);
            delete request.payload.reqId;
            return reqData;
        }

        request.log([ 'test-pre-error' ], `No matching request for key ${ reqId }.`);
        throw new Errors.RequestKeyCacheError();
    } catch (error) {
        request.log([ 'test-pre-error' ], `Error retrieving and processing request data from Catbox with key ${ reqId }: ${ error }.`);
        throw new Errors.RequestKeyCacheError();
    }
};
