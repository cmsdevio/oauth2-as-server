/* eslint-disable camelcase */
/**
 * Crafted in Erebor by thorin on 2018-05-14
 */
const Joi = require('joi');

const reqId = Joi.string().token().max(15).required();
const client_id = Joi.string().min(50).max(150).required();
const redirect_uri = Joi.string().uri().required();
const response_type = Joi.any().allow('code');
const scopes = Joi.string().allow('').optional();
const state = Joi.string().token().allow('');

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
