const meta = require('./package');
const Path = require('path');

// TODO: put validation schema back in this file
exports.register = (server, options, next) => {
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
    // server.route({
    //     method: 'GET',
    //     path: '/login',
    //     handler: LoginHandler.getLogin,
    //     config: {
    //         pre: [ {
    //             assign: 'req_id',
    //             method: FormUtils.setRequestKey
    //         } ],
    //         auth: {
    //             strategy: 'auth-session-as',
    //             mode: 'try'
    //         },
    //         plugins: {
    //             'hapi-auth-cookie': {
    //                 redirectTo: false
    //             }
    //         },
    //         validate: {
    //             query: {
    //                 next: Joi.string()
    //             }
    //         }
    //     }
    // });

    // server.route({
    //     method: 'POST',
    //     path: '/login',
    //     handler: LoginHandler.postLogin,
    //     config: {
    //         pre: [ {
    //             assign: 'req_data',
    //             method: FormUtils.checkRequestKey
    //         } ],
    //         auth: {
    //             strategy: 'auth-session-as',
    //             mode: 'try'
    //         },
    //         plugins: {
    //             'hapi-auth-cookie': {
    //                 redirectTo: false
    //             }
    //         },
    //         validate: {
    //             payload: LoginHandler.loginSchema
    //         }
    //     }
    // });

    next();
};

exports.register.attributes = {
    pkg: meta
};
