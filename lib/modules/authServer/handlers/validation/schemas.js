/* eslint-disable camelcase */
/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
const Joi = require('joi');

const reqId = Joi.string().token().max(15).required();
const client_id = Joi.string().min(50).max(150).required();
const client_name = Joi.string().token().min(10).max(50).required();
const redirect_uri = Joi.string().uri().required();
const response_type = Joi.string().valid('code', 'token');
const scopes = Joi.string().allow('').optional();
const state = Joi.string().token().allow('');
const client_uri = Joi.string().uri().optional();
const token_endpoint_auth_method = Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt').optional();
const grant_type = Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token').optional();

// *******************************************************
// Client Authorization Endpoint
// *******************************************************
module.exports.authorizationSchema = {
    client_id,
    redirect_uri,
    response_type,
    scopes,
    state
};

// *******************************************************
// Dynamic Client Endpoint
// *******************************************************
module.exports.registrationSchema = {
    client_name,
    client_uri,
    redirect_uri,
    response_type,
    token_endpoint_auth_method,
    grant_type,
    scopes
};
