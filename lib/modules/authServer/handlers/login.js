const Axios = require('axios');
const https = require('https');
const Joi = require('joi');

const Models = require('../persistence/mongodb/models');

const axios = Axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

module.exports.loginSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
    req_id: Joi.string().token().max(25).required(),
    next: Joi.string()
};

module.exports.getLogin = function(request, reply) {
    const nextUrl = request.query.next;

    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/oauth2/home');
    }

    return reply.view('login', {
        req_id: request.pre.req_id,
        next: nextUrl,
        user: request.auth.credentials
    })
};

module.exports.postLogin = function(request, reply) {
    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/oauth2/home');
    }

    const {email, password, next} = request.payload;

    Models
        .findUserByEmail(email)
        .then((user) => {
            //TODO: handling password comparison
            if (!user || user.password !== password) {
                request.log(['oauth2-login-error'], `Invalid email or password for user ${email}.`);
                return reply.redirect('/oauth2/login');
            } else {
                request.log(['oauth2-login'], `Login successful for user ${email}.`);
                request.cookieAuth.set({email: user.email, scope: user.role});
                if (next) {
                    return reply.redirect(next);
                } else {
                    return reply.redirect('/oauth2/home');
                }
            }
        }, (err) => {
            request.log(['oauth2-login-error'], `Error login in with user ${email}: ${err}.`);
            return reply.view('error', {
                error_message: err.message
            });
        });

    /*ProviderServices.submitLogin({email: email, password: password})
        .then(response => {
            if (response.statusCode !== 200) {
                return reply.redirect('/ui/login');
            }

            const {token, scope} = response.data;

            request.log(['ui-login'], `Successfully logged in with ${email}.`);
            request.cookieAuth.set({token: token, email: email, scope: scope});
            if (next) {
                return reply.redirect(next);
            } else {
                return reply.redirect('/ui/home');
            }
        })
        .catch(err => {
            request.log(['ui-login-error'], `Error login in: ${err}.`);
            return reply.view('error', {
                error_message: err.message,
                user: request.auth.credentials
            });
        });*/
};

module.exports.postApiLogin = function(request, reply) {
    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/ui/home');
    }

    const {email, password, next} = request.payload;

    Models
        .findUserByEmail(email)
        .then((user) => {
            //TODO: handling password comparison
            if (!user || user.password !== password) {
                request.log(['oauth2-login-error'], `Invalid email or password for user ${email}.`);
                return reply('Not authorized').code(401);
            } else {
                request.log(['oauth2-login'], `Login successful for user ${email}.`);
                reply({token: user.token, email: email, scope: scope});
            }
        }, (err) => {
            request.log(['oauth2-login-error'], `Error login in with user ${email}: ${err}.`);
            return reply('Not authorized').code(401);
        });
};

module.exports.validateFunc = (token, callback) => {
    return callback(null, true, { token: token });
    /*const reqCacheClient = request.server.root.app.caching_catbox_memory;
    const key = { id: token, segment: 'requests' };
    reqCacheClient.get(key, (err, cached) => {
        if (err) {
            server.log(['oauth2-bearer-error'], `Error retrieving token ${token} from Catbox.`);
            return callback(null, false, { token: token });
        } else if (cached) {
            server.log(['oauth2-bearer'], `Successfully retrieved token ${token} from cache.`);
            return callback(null, true, { token: token, user_id: cached.item });
        } else {
            server.log(['oauth2-bearer'], `Mis-matched token ${token}.`);
            return callback(null, false, { token: token });
        }
    });*/
};

module.exports.logout = function(request, reply) {
    request.cookieAuth.clear();
    return reply.redirect('/oauth2/login');
};