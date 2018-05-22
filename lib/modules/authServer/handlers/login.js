// const Axios = require('axios');
// const https = require('https');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const Boom = require('boom');

const TokenUtils = require('../utils/token-util');

const secretKey = process.env.AUTH_SECRET_KEY || 'OCW6s6K5yAtdLI2b/7GZpzWQNmxwmb5IF1bb1xv9WHQoBH/+Y9WBMyb9OSJfGvS+2Iza8g0U2oZhupVIjvJw4HVHIYZIGdcJJhvnrI0i3kRIB1HWAz0eh2myjFs7B5ZHM2vYBHxYdXUnEceg11RhClAc3+jLuCTkaDYbHwhZehHBIiTiLb1fSoF7x70tUAGrikChsfSKx7Kr+OKca7osk79e57jG67qG2hK0jevV/SCM/nOmw0HFke62GHM8HkY3nIQTWQ1p4o3VUta80C9ADU3Cs1DagUCyO/rYVD/WVgzv26YC8Ed8OIj3Rjby+OgJTGSL1SZKvuIVuIGObCAFHA==';
// const axios = Axios.create({
//     httpsAgent: new https.Agent({
//         rejectUnauthorized: false
//     })
// });

module.exports.loginSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required(),
    reqId: Joi.string().token().max(25).required(),
    next: Joi.string()
};

module.exports.adminLoginSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(200).required()
};

module.exports.getLogin = (request, h) => {
    const nextUrl = request.query.next;

    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return h.redirect('/oauth2/home');
    }

    return h.view('login', {
        reqId: request.pre.reqId,
        next: nextUrl,
        user: request.auth.credentials
    });
};

module.exports.postLogin = async (request, h) => {
    const Models = request.server.app.db;
    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return h.redirect('/oauth2/home');
    }

    const { email, password, next } = request.payload;

    try {
        const user = await Models.findUserByEmail(email);
        // TODO: handling password comparison
        if (!user || user.password !== password) {
            request.log([ 'oauth2-login-error' ], `Invalid email or password for user ${ email }.`);
            return h.redirect('/oauth2/login');
        }
        request.log([ 'oauth2-login' ], `Login successful for user ${ email }.`);
        request.cookieAuth.set({ email: user.email, scope: user.role });
        if (next) {
            return h.redirect(next);
        }
        return h.redirect('/oauth2/home');
    } catch (error) {
        request.log([ 'oauth2-login-error' ], `Error login in with user ${ email }: ${ error }.`);
        return h.view('error', {
            error_message: error.message
        });
    }
};

module.exports.adminPostLogin = async (request, h) => {
    const Models = request.server.app.db;
    const options = request.server.app.adminOptions;
    const sessionCacheClient = request.server.root.app.session_caching_catbox_memory;

    const { email, password } = request.payload;

    try {
        const user = await Models.findUserByEmail(email);
        console.log(user.password);
        console.log(bcrypt.compareSync(password, user.password));
        // TODO: extract to async util function
        if (!user || !bcrypt.compareSync(password, user.password)) {
        // if (!user || user.password !== password) {
            request.log([ 'admin-login-error' ], `Invalid email or password for user ${ email }.`);
            return h(Boom.unauthorized('Invalid credentials.'));
        }

        const token = TokenUtils.generateTokenString();
        sessionCacheClient.set(
            { id: token, segment: 'sessions' },
            user.toObject(),
            options.sessionLength,
            (err) => {
                if (err) {
                    console.log(err);
                    return h(Boom.internal('Login error.'));
                }
                request.log([ 'admin-login' ], `Login successful for user ${ email }.`);
                return h({ token, role: user.role });
            }
        );
    } catch (err) {
        request.log([ 'admin-login-error' ], `Error login in with user ${ email }: ${ err }.`);
        return h(Boom.internal('Login error.'));
    }
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

module.exports.validateFunc = async (request, token, h) => {
    // const isTokenValid = await bcrypt.compare(secretKey, token);
    const isTokenValid = token === secretKey;
    if (!isTokenValid) {
        console.error('Bearer token is invalid.');
    }
    const credentials = { token };
    return { isTokenValid, credentials };
};

module.exports.logout = (request, h) => {
    request.cookieAuth.clear();
    return h.redirect('/oauth2/login');
};
