/* eslint-disable camelcase */
/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
const Joi = require('joi');

// const reqId = Joi.string().token().max(15);
const client_id = Joi.string().token().length(50);
const client_secret = Joi.string().token().length(100);
const client_name = Joi.string().token().min(10).max(100);
const array_redirect_uris = Joi.alternatives()
    .try(Joi.string().uri(), Joi.array().items(Joi.string()).min(1));
const redirect_uri = Joi.string().uri();
const array_response_types = Joi.array().items(Joi.string());
const response_type = Joi.string().allow('code', 'token', ' ');
const scope = Joi.string().allow('');
const state = Joi.string().token().allow('');
const client_uri = Joi.string().uri();
const token_endpoint_auth_method = Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt');
const grant_type = Joi.string().valid('authorization_code', 'implicit', 'client_credentials', 'refresh_token');
const array_grant_types = Joi.array().items(Joi.ref('grant_type'));
const code = Joi.string().token().max(100);

// *******************************************************
// Client Authorization Endpoint
// *******************************************************
module.exports.authorizationSchema = {
    client_id: client_id.required(),
    redirect_uri: redirect_uri.required(),
    response_type: response_type.optional(),
    scope: scope.optional(),
    state: state.optional()
};

// *******************************************************
// Dynamic Client Endpoint
// *******************************************************
module.exports.registrationSchema = {
    client_name: client_name.required(),
    client_uri: client_uri.optional(),
    array_redirect_uris,
    array_response_types,
    token_endpoint_auth_method: token_endpoint_auth_method.optional(),
    array_grant_types,
    scope: scope.optional()
};

// *******************************************************
// Token Endpoint -- Basic Auth
// *******************************************************
module.exports.tokenSchema = {
    grant_type: grant_type.optional(),
    code: code.optional(),
    redirect_uri: redirect_uri.required(),
    client_id: client_id.optional(),
    client_secret: client_secret.optional()
};
