/* eslint-disable no-param-reassign */
const Mongoose = require('mongoose');
const { ObjectID } = require('mongodb');

const clientSchema = Mongoose.Schema(
    {
        client_id: { type: String, unique: true, required: true },
        client_name: { type: String, unique: true },
        client_secret: { type: String, required: true },
        redirect_uris: [ { type: String, required: true } ],
        scope: { type: String },
        isActive: { type: Boolean, required: true },
        grant_types: [ { type: String, required: true } ],
        response_type: { type: String },
        client_id_created_at: { type: Number },
        client_secret_expires_at: { type: Number },
        token_endpoint_auth_method: { type: String }
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const codeSchema = Mongoose.Schema(
    {
        code: { type: String, required: true },
        client_id: { type: String, required: true },
        redirect_uri: { type: String, required: true },
        state: { type: String, required: true },
        scope: { type: String },
        ttl: { type: Date, required: true }
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const tokenSchema = Mongoose.Schema(
    {
        access_token: { type: String, required: true },
        refresh_token: { type: String, required: true },
        client_id: { type: String, required: true },
        token_type: { type: String, required: true },
        state: { type: String, required: true },
        scope: { type: String },
        ttl: Date
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const userSchema = Mongoose.Schema(
    {
        email: { type: String, unique: true, required: true },
        password: { type: String, required: true },
        token: { type: String, unique: true },
        isActive: { type: Boolean, required: true },
        role: { type: String, required: true }
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const Client = Mongoose.model('Client', clientSchema);
const Code = Mongoose.model('Code', codeSchema);
const Token = Mongoose.model('Token', tokenSchema);
const User = Mongoose.model('User', userSchema);

// *********************************
// CLIENTS
// *********************************
module.exports.findClientById = clientId => Client.findOne({ client_id: clientId });

module.exports.findClients = () => Client.find();

module.exports.deleteClient = (clientId, userId) =>
    Client.findOneAndRemove({ client_id: clientId, user_id: ObjectID(userId) });

module.exports.saveClient = (clientData) => {
    clientData.user_id = ObjectID(clientData.user_id);
    if (!clientData.isActive) {
        clientData.isActive = true;
    }
    const newClient = new Client(clientData);
    return newClient.save();
};

// ****************************************************
// CODES
// ****************************************************
module.exports.deleteCode = _id =>
    Code.findOneAndRemove({ _id: ObjectID(_id) });

module.exports.findCodeByValue = code => Code.findOne({ code });

module.exports.saveCode = (codeData) => {
    const newCode = new Code(codeData);
    return newCode.save();
};

// *************************************************
// USERS
// *************************************************
module.exports.findUsers = () => User.find();

module.exports.findUserByEmail = email => User.findOne({ email });

module.exports.insertLoginToken = (_id, data) =>
    User.findOneAndUpdate({ _id: ObjectID(_id) }, data);

module.exports.saveUser = (userData) => {
    const newUser = new User(userData);
    if (!userData.isActive) {
        userData.isActive = true;
    }
    return newUser.save();
};

// *************************************************
// TOKENS
// *************************************************
module.exports.findTokensByClientAndProviderIds = (clientId, providerId) =>
    Token.find({ clientId, provider_id: ObjectID(providerId) });

module.exports.findTokenById = _id => Token.findOne({ _id: ObjectID(_id) });

module.exports.findTokenByRefresh = refreshToken =>
    Token.findOne({ refreshToken });

module.exports.deleteTokenByClientId = clientId =>
    Token.findOneAndRemove({ clientId });

module.exports.deleteToken = _id =>
    Token.findOneAndRemove({ _id: ObjectID(_id) });

module.exports.saveToken = (tokenData) => {
    const newToken = new Token(tokenData);
    return newToken.save();
};
