/**
 * Crafted in Erebor by thorin on 2018-04-16
 */
const Joi = require('joi');
const Randomstring = require('randomstring');
const Boom = require('boom');

module.exports.basicClientSchema = {
    client_name: Joi.string().token().min(10).max(50)
        .required(),
    redirect_uri: Joi.string().optional(),
    scope: Joi.string().optional()
    // client_id: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    // client_secret: Joi.string().regex(/^[a-zA-Z0-9-]{8,150}$/).required(),
    // client_description: Joi.string().allow(''),
    // response_type: Joi.string().valid('code', 'token').required(),
    // token_endpoint_auth_method: Joi.string().valid('none', 'client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt')
};

module.exports.getClients = async (request, reply) => {
    const user = { ...request.auth.credentials };
    const Models = request.server.app.db;
    try {
        const dbUser = await Models.findUserById(user._id);
        const listClients = await Models.findListClientsByIds(dbUser.client_refs);
        return reply({ listClients });
    } catch (err) {
        request.log([ 'admin-clients-error' ], `Error fetching clients: ${ err }.`);
        return reply(Boom.internal('Error fetching list of clients.'));
    }
};

module.exports.addClient = async (request, reply) => {
    const user = { ...request.auth.credentials };
    const Models = request.server.app.db;
    const clientData = { ...request.payload };
    request.log([ 'admin-addClient' ], `Received new client data ${ JSON.stringify(clientData) }.`);
    // Generate grant_type. Hardcoded to "code" for now
    clientData.grant_type = 'authorization_code';
    // Generate response_type.
    clientData.response_type = 'code';
    // Generate auth for token endpoint
    clientData.token_endpoint_auth_method = 'client_secret_basic';
    // Generate ID and secret
    clientData.client_id = Randomstring.generate(100);
    clientData.client_secret = Randomstring.generate(100);
    clientData.client_secret_expires_at = 0;
    request.log([ 'admin-addClient' ], `Persisting new client: ${ JSON.stringify(clientData) }.`);
    try {
        const client = await Models.saveClient(clientData);
        const updatedUser = await Models.updateClientsForUserId(user._id, client._id);
        request.log([ 'admin-addClient' ], `Successfully saved client ${ client }.`);
        request.log([ 'admin-addClient' ], `Successfully added client reference to user ${ updatedUser }.`);
        return reply(client)
            .code(201);
    } catch (err) {
        request.log([ 'admin-addClient-error' ], `Error creating client: ${ err }.`);
        if (err.code === 11000) {
            return reply(Boom.badRequest('Client already exists.'));
        }
        return reply(Boom.internal('Error creating client.'));
    }
};
