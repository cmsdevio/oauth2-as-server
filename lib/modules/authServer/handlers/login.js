// const Axios = require('axios');
// const https = require('https');
const Joi = require('joi');

// const axios = Axios.create({
//     httpsAgent: new https.Agent({
//         rejectUnauthorized: false
//     })
// });

module.exports.loginSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
    req_id: Joi.string().token().max(25).required(),
    next: Joi.string()
};

module.exports.getLogin = (request, reply) => {
    const nextUrl = request.query.next;

    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/oauth2/home');
    }

    return reply.view('login', {
        req_id: request.pre.req_id,
        next: nextUrl,
        user: request.auth.credentials
    });
};

module.exports.postLogin = (request, reply) => {
    const Models = request.server.app.db;
    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/oauth2/home');
    }

    const { email, password, next } = request.payload;

    Models
        .findUserByEmail(email)
        .then((user) => {
            // TODO: handling password comparison
            if (!user || user.password !== password) {
                request.log([ 'oauth2-login-error' ], `Invalid email or password for user ${ email }.`);
                return reply.redirect('/oauth2/login');
            }
            request.log([ 'oauth2-login' ], `Login successful for user ${ email }.`);
            request.cookieAuth.set({ email: user.email, scope: user.role });
            if (next) {
                return reply.redirect(next);
            }
            return reply.redirect('/oauth2/home');
        }, (err) => {
            request.log([ 'oauth2-login-error' ], `Error login in with user ${ email }: ${ err }.`);
            return reply.view('error', {
                error_message: err.message
            });
        });
};

module.exports.postApiLogin = (request, reply) => {
    const Models = request.server.app.db;
    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/ui/home');
    }

    const { email, password } = request.payload;

    Models
        .findUserByEmail(email)
        .then((user) => {
            // TODO: handling password comparison
            if (!user || user.password !== password) {
                request.log([ 'oauth2-login-error' ], `Invalid email or password for user ${ email }.`);
                return reply('Not authorized').code(401);
            }
            request.log([ 'oauth2-login' ], `Login successful for user ${ email }.`);
            // TODO: scope???
            // return reply({ token: user.token, email, scope});
            return reply({ token: user.token, email });
        }, (err) => {
            request.log([ 'oauth2-login-error' ], `Error login in with user ${ email }: ${ err }.`);
            return reply('Not authorized').code(401);
        });
};

module.exports.validateFunc = (token, callback) =>
    callback(null, true, { token });

module.exports.logout = (request, reply) => {
    request.cookieAuth.clear();
    return reply.redirect('/oauth2/login');
};
