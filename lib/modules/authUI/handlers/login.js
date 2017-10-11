import Axios from 'axios';
const https = require('https');

const ProviderServices = require('../services/provider');

const axios = Axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

module.exports.getLogin = function(request, reply) {
    const nextUrl = request.query.next;

    if (request.auth.isAuthenticated) {
        console.log('****  /login already authenticated.');
        return reply.redirect('/ui/home');
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
        return reply.redirect('/ui/home');
    }

    const {email, password, next} = request.payload;

    ProviderServices.submitLogin({email: email, password: password})
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
        });
};

module.exports.logout = function(request, reply) {
    request.cookieAuth.clear();
    return reply.redirect('/ui/login');
};