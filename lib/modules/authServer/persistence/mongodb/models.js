const Mongoose = require('mongoose');
const ObjectID = require('mongodb').ObjectID;

Mongoose.Promise = require('bluebird');
Mongoose.set('debug', "true");
const mongoConnectionUri = process.env.MONGO_URI || 'mongodb://localhost/Test';
Mongoose.connect(mongoConnectionUri, {useMongoClient: true});

const clientSchema = Mongoose.Schema({
        client_id: {type: String, unique: true, required: true},
        client_name: {type: String, unique: true},
        client_secret: {type: String, required: true},
        redirect_uris: [{type: String, required: true}],
        scope: {type: String},
        isActive: {type: Boolean, required: true},
        grant_types: [{type: String, required: true}],
        response_type: {type: String},
        client_id_created_at: {type: Number},
        client_secret_expires_at: {type: Number},
        token_endpoint_auth_method: {type: String}
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
        ttl: {type: Date, required: true}
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
        email: {type: String, unique: true, required: true},
        password: {type: String, required: true},
        token: {type: String, unique: true, required: true},
        isActive: {type: Boolean, required: true},
        role: {type: String, required: true},
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
    if (!client_data.isActive) {
        client_data.isActive = true;
    }
    const newClient = new Client(client_data);
    return newClient.save();
};

/*************************************************/
/*                     Codes                     */
/*************************************************/
module.exports.deleteCode = function(_id) {
    return Code.findOneAndRemove({_id: ObjectID(_id)})
};

module.exports.findCodeByValue = function(code) {
    return Code.findOne({code: code})
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
    if (!user_data.isActive) {
        user_data.isActive = true;
    }
    return newUser.save();
};

/*************************************************/
/*                     Tokens                    */
/*************************************************/
module.exports.findTokensByClientAndProviderIds = function(client_id, provider_id) {
    return Token.find({client_id: client_id, provider_id: ObjectID(provider_id)});
};

module.exports.findTokenById = function(_id) {
    return Token.findOne({_id: ObjectID(_id)});
};

module.exports.findTokenByRefresh = function(refresh_token) {
    return Token.findOne({refresh_token: refresh_token});
};

module.exports.deleteTokenByClientId = function(client_id) {
    return Token.findOneAndRemove({client_id: client_id});
};

module.exports.deleteToken = function(_id) {
    return Token.findOneAndRemove({_id: ObjectID(_id)});
};

module.exports.saveToken = function(token_data) {
    const newToken = new Token(token_data);
    return newToken.save();
};