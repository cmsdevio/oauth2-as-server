const Axios = require('axios');
const https = require('https');

const axios = Axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

const apiBaseUrl = process.env.PROVIDER_API || 'https://localhost:8443/oauth2';

module.exports.submitLogin = (data) => axios.post(`${apiBaseUrl}/login`, data);

module.exports.registerClient = (url, data) => axios.post(url, data);

module.exports.getToken = (url, data, config) => axios.post(url, data, config);