// const Axios = require('axios');
// const https = require('https');
const Joi = require('joi');
const Boom = require('boom');
const RandomString = require('randomstring');

module.exports.loginSchema = {
    email: Joi.string().email().required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required()
};

module.exports.postLogin = async (request, reply) => {
    const Models = request.server.app.db;
    const sessionCacheClient = request.server.root.app.session_caching_catbox_memory;

    const { email, password } = request.payload;

    try {
        const user = await Models.findUserByEmail(email);
        if (!user || user.password !== password) {
            request.log([ 'admin-login-error' ], `Invalid email or password for user ${ email }.`);
            return reply(Boom.unauthorized('Invalid credentials.'));
        }

        // TODO: extract to utils lib? Lenght as param?
        const token = RandomString.generate(25);
        sessionCacheClient.set({ id: token, segment: 'sessions' }, { user }, 120000, (err) => {
            if (err) {
                console.log(err);
                return reply(Boom.internal('Login error.'));
            }
            request.log([ 'admin-login' ], `Login successful for user ${ email }.`);
            return reply({ token });
        });
    } catch (err) {
        request.log([ 'admin-login-error' ], `Error login in with user ${ email }: ${ err }.`);
        return reply(Boom.internal('Login error.'));
    }
};

module.exports.logout = (request, reply) => reply('TBD');
