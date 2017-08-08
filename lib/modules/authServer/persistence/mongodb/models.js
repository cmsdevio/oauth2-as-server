const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;
const ObjectID = require('mongodb').ObjectID;

const clientSchema = Mongoose.Schema({
        client_id: {type: String, required: true},
        client_secret: {type: String, required: true},
        redirect_uris: [{type: String, required: true}],
        scope: {type: String},
        active: {type: Boolean}
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const codeSchema = Mongoose.Schema({
        code: {type: String, required: true},
        client_id: {type: String, required: true},
        redirect_uri: {type: String, required: true},
        state: {type: String, required: true},
        scope: {type: String},
        ttl: Date
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const tokenSchema = Mongoose.Schema({
        access_token: {type: String, required: true},
        refresh_token: {type: String, required: true},
        client_id: {type: String, required: true},
        token_type: {type: String, required: true},
        state: {type: String, required: true},
        scope: {type: String},
        ttl: Date
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const userSchema = Mongoose.Schema({
        email: {type: String, required: true},
        password: {type: String, required: true},
        active: {type: Boolean},
        role: {type: String},
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

/*************************************************/
/*                    Clients                    */
/*************************************************/
module.exports.findClientById = function(client_id) {
    return Client.findOne({client_id: client_id});
};

module.exports.findClients = function() {
    return Client.find();
};

module.exports.deleteClient = function(client_id, user_id) {
    return Client.findOneAndRemove({client_id: client_id, user_id: ObjectID(user_id)})
};

module.exports.saveClient = function(client_data) {
    client_data.user_id = ObjectID(client_data.user_id);
    const newClient = new Client(client_data);
    return newClient.save();
};

/*************************************************/
/*                     Codes                     */
/*************************************************/
module.exports.deleteCode = function(code, client_id) {
    return Code.findOneAndRemove({code: code, client_id: client_id})
};

module.exports.saveCode = function(code_data) {
    const newCode = new Code(code_data);
    return newCode.save();
};

/*************************************************/
/*                     Users                     */
/*************************************************/
module.exports.findUsers = function() {
    return User.find();
};

module.exports.findUserByEmail = function(email) {
    return User.findOne({email: email});
};

module.exports.saveUser = function(user_data) {
    const newUser = new User(user_data);
    return newUser.save();
};

/*************************************************/
/*                     Tokens                    */
/*************************************************/
module.exports.findTokenByRefresh = function(refresh_token) {
    return Token.findOne({refresh_token: refresh_token});
};

module.exports.deleteTokenByClientId = function(client_id) {
    return Token.findOneAndRemove({client_id: client_id});
};

module.exports.deleteToken = function(_id) {
    return Token.find({_id: ObjectID(_id)}).remove();
};

module.exports.saveToken = function(token_data) {
    const newToken = new Token(token_data);
    return newToken.save();
};