const meta = require('./package');
const Path = require('path');
// const Joi = require('joi');

const LoginHandler = require('./handlers/login');

exports.register = (server, options, next) => {
    server.auth.strategy('api-as', 'bearer-access-token', {
        allowMultipleHeaders: true,
        validateFunc: async (token, callback) => {
            const sessionCacheClient = server.root.app.session_caching_catbox_memory;
            let isSessionValid = false;
            let user = null;
            const key = { id: token, segment: 'sessions' };

            sessionCacheClient.get(key, (err, cached) => {
                if (err) {
                    server.log([ 'admin-token-error' ], `Error retrieving request data from Catbox with key ${ token }.`);
                    throw err;
                }
                if (cached) {
                    user = cached.item;
                    server.log([ 'admin-token' ], `Successfully retrieved item from cache with key ${ token }: ${ JSON.stringify(user) }.`);
                    isSessionValid = user && user.isActive;
                } else {
                    server.log([ 'admin-token-error' ], `No matching request for key ${ token }.`);
                }
            });
            return callback(null, isSessionValid, { user });
        }
    });

    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: Path.join(__dirname, 'public')
            }
        },
        config: {
            auth: false
        }
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, reply) => {
            reply.file('index.html');
        }
    });

    // *************************************************
    // LOGIN
    // *************************************************
    server.route({
        method: 'POST',
        path: '/login',
        handler: LoginHandler.postLogin,
        config: {
            auth: false
            // validate: {
            //     payload: LoginHandler.loginSchema
            // }
        }
    });

    // *************************************************
    // LOGIN
    // *************************************************
    server.route({
        method: 'POST',
        path: '/clients',
        handler: (request, reply) => reply({ foo: 'bar' }),
        config: {
            auth: 'api-as'
        }
    });

    next();
};

exports.register.attributes = {
    pkg: meta
};
