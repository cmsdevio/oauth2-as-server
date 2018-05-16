/* eslint-disable no-param-reassign */
const Mongoose = require('mongoose');
const { ObjectID } = require('mongodb');

const clientSchema = Mongoose.Schema(
    {
        client_id: { type: String, unique: true, required: true },
        client_name: { type: String, unique: true },
        client_secret: { type: String, required: true },
        redirect_uri: { type: String, required: true },
        scope: { type: String },
        isActive: { type: Boolean, required: true },
        grant_type: { type: String, required: true },
        response_type: { type: String },
        client_secret_expires_at: { type: Number },
        token_endpoint_auth_method: { type: String }
    },
    {
        timestamps: {
            createdAt: 'client_id_created_at',
            updatedAt: 'updated_at'
        }
    }
);

const codeSchema = Mongoose.Schema(
    {
        code: { type: String, required: true, unique: true },
        client_id: { type: String, required: true, unique: true },
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
        refresh_token: { type: String, required: false },
        client_id: { type: String, required: true, unique: true },
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

// TODO: add back
// client_refs: [ { type: Mongoose.Schema.Types.ObjectId, unique: true } ]
const userSchema = Mongoose.Schema(
    {
        email: { type: String, unique: true, required: true },
        password: { type: String, required: true },
        isActive: { type: Boolean, required: true },
        role: { type: String, required: true },
        client_refs: [ { type: Mongoose.Schema.Types.ObjectId } ]
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

module.exports.findListClientsByIds = (arrayOfRefs) => {
    const clientIds = [];
    let i;
    for (i = 0; i < arrayOfRefs.length; i += 1) {
        clientIds.push(ObjectID(arrayOfRefs[i]));
    }
    console.log(clientIds);
    return Client.find({ _id: { $in: clientIds } });
};

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

module.exports.findUserById = _id => User.findOne({ _id: ObjectID(_id) });

module.exports.updateClientsForUserId = (_id, clientId) =>
    User.findByIdAndUpdate(
        _id,
        { $push: { client_refs: ObjectID(clientId) } },
        { safe: true, upsert: true, new: true }
    );

module.exports.saveUser = (userData) => {
    if (!userData.isActive) {
        userData.isActive = true;
    }
    const newUser = new User(userData);
    return newUser.save();
};

// *************************************************
// TOKENS
// *************************************************
module.exports.findTokenByClientId = client_id => Token.find({ client_id });

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
