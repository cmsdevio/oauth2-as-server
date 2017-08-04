const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;
const ObjectID = require('mongodb').ObjectID;

const internals = {};

const clientSchema = new Schema({
    client_id: {type: String, required: true},
    user_id: {type: Schema.ObjectId, required: true},
    client_secret: {type: String, required: true},
    redirect_uris: [{type: String, required: true}],
    scope: {type: String},
    active: {type: Boolean}
}, { timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
}
});

exports = module.exports = internals.Client = function() {
    this._client = Mongoose.model('Client', clientSchema);
};

internals.Client.prototype.findByClientId = function(clientId) {
    return this._client
        .find({client_id: clientId})
        .then((client) => {
            if (!Array.isArray(client) || (Array.isArray(client) && client.length !== 1)) {
                console.error(`Unknown client ID ${clientId}.`);
                return null;
            } else {
                return client.shift();
            }
        }, (err) => {
            return err;
        });
};

internals.Client.prototype.findByClientAndUserId = function(clientId, userId) {
    return this._client
        .find({client_id: clientId, user_id: ObjectID(userId)})
        .then((client) => {
            if (!Array.isArray(client) || (Array.isArray(client) && client.length !== 1)) {
                console.error(`Unknown client ID ${clientId}.`);
                return null;
            } else {
                return client.shift();
            }
        }, (err) => {
            return err;
        });
};

internals.Client.prototype.findByUserId = function(userId) {
    return this._client
        .find({user_id: ObjectID(userId)})
        .then((clients) => {
            return clients;
        }, (err) => {
            return err;
        });
};

internals.Client.prototype.find = function() {
    return this._client
        .find((clients) => {
            return clients
        }, (err) => {
            return err;
        });
};

internals.Client.prototype.create = function(data) {
    data.user_id = ObjectID(data.user_id);
    return new this._client(data);
};

internals.Client.prototype.delete = function(clientId, userId) {
    return this._client
        .findOneAndRemove({client_id: clientId, user_id: ObjectID(userId)})
        .then((client) => {
            return client;
        }, (err) => {
            return err;
        });
};