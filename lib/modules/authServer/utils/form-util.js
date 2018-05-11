const Randomstring = require('randomstring');

module.exports.setRequestKey = async (request, h) => {
    const reqCacheClient = request.server.app.req_caching_catbox_memory;
    const reqId = Randomstring.generate(12);
    const key = { id: reqId, segment: 'requests' };
    try {
        await reqCacheClient.set(key, request.query, 120000);
        request.log([ 'test-pre' ], `Successfully persisted request to cache with key ${ reqId }.`);
        return reqId;
    } catch (error) {
        request.log([ 'test-pre-error' ], `Error saving request to cache with key ${ reqId }.`);
        return null;
    }
};

module.exports.checkRequestKey = async (request, h) => {
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
        h.view('error', {
            error_message: 'An error occurred. Please try again later.',
            user: request.auth.credentials
        });
    } catch (error) {
        request.log([ 'test-pre-error' ], `Error retrieving and processing request data from Catbox with key ${ reqId }.`);
        return null;
    }

    /*reqCacheClient.get(key, (err, cached) => {
        if (err) {
            request.log([ 'test-pre-error' ], `Error retrieving request data from Catbox with key ${ reqId }.`);
            throw err;
        }
        if (cached) {
            const req_data = cached.item;
            request.log([ 'test-dcr' ], `Successfully retrieved item from cache with key ${ reqId }: ${ JSON.stringify(req_data) }.`);

            reqCacheClient.drop(key, (err) => {
                if (err) {
                    request.log([ 'test-pre-error' ], `Error dropping item from cache with key ${ reqId }: ${ err }.`);
                    throw err;
                }
                request.log([ 'test-pre' ], `Successfully dropped item from cache with key ${ reqId }.`);
                delete request.payload.req_id;
                h(req_data);
            });
        } else {
            request.log([ 'test-pre-error' ], `No matching request for key ${ reqId }.`);
            h.view('error', {
                error_message: 'An error occurred. Please try again later.',
                user: request.auth.credentials
            });
        }
    });*/
};
