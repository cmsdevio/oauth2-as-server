/**
 * Crafted in Erebor by thorin on 2018-04-23
 */
const Boom = require('boom');
const Joi = require('joi');
const bcrypt = require('bcrypt');

module.exports.basicUserSchema = {
    email: Joi.string().email()
        .required(),
    password: Joi.string().required()
};

module.exports.getUsers = async (request, reply) => {
    const Models = request.server.app.db;
    try {
        const listUsers = await Models.findUsers();
        const formattedListUsers = listUsers.map(user => ({
            _id: user._id,
            email: user.email,
            role: user.role,
            created_at: user.created_at
        }));
        return reply({ listUsers: formattedListUsers });
    } catch (err) {
        request.log([ 'admin-users-error' ], `Error fetching users: ${ err }.`);
        return reply(Boom.internal('Error fetching list of clients.'));
    }
};

module.exports.addUser = async (request, reply) => {
    const Models = request.server.app.db;
    const userData = { ...request.payload };
    request.log([ 'admin-addUser' ], `Received new user data ${ JSON.stringify(userData) }.`);
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(userData.password, salt);
    try {
        const user = await Models.saveUser({
            email: userData.email,
            password: hash,
            salt,
            role: 'user'
        });
        request.log([ 'admin-addUser' ], `Successfully saved user ${ user }.`);
        return reply(user)
            .code(201);
    } catch (err) {
        request.log([ 'admin-addUser-error' ], `Error creating user: ${ err }.`);
        if (err.code === 11000) {
            return reply(Boom.badRequest('User already exists.'));
        }
        return reply(Boom.internal('Error creating user.'));
    }
};
