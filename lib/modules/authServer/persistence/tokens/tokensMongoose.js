const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;
const ObjectID = require('mongodb').ObjectID;

const internals = {};

const tokenSchema = new Schema({
    access_token: {type: String, required: true},
    refresh_token: {type: String, required: true},
    client_id: {type: String, required: true},
    token_type: {type: String, required: true},
    state: {type: String, required: true},
    scope: {type: String},
    ttl: Date
}, { timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
}
});

exports = module.exports = internals.Token = function() {
    this._token = Mongoose.model('Token', tokenSchema);
};

internals.Token.prototype.save = function() {
    this._token.save((err, token) => {
        if (err) return console.error(err);
        return token;
    });
};

internals.Token.prototype.create = function(data) {
    return new this._token(data);
};

internals.Token.prototype.findByRefreshToken = function(refreshToken) {
    return this._token
        .find({refresh_token: refreshToken})
        .then((token) => {
            if (!Array.isArray(token) || (Array.isArray(token) && token.length !== 1)) {
                console.error(`Unknown refresh token ${refreshToken}.`);
                return null;
            } else {
                return token.shift();
            }
        }, (err) => {
            return err;
        });
};

internals.Token.prototype.delete = function(_id) {
    return this._token
        .find({_id: ObjectID(_id)})
        .remove()
        .then((result) => {
            return result;
        }, (err) => {
            return err;
        });
};

internals.Token.prototype.findById = function(_id) {
    return this._token
        .findOne({_id: ObjectID(_id)})
        .then((token) => {
            return token;
        }, (err) => {
            return err;
        });
};

internals.Token.prototype.findByClientIdAndDelete = function(client_id) {
    return this._token
        .findOneAndRemove({client_id: client_id})
        .then((token) => {
            return token;
        }, (err) => {
            return err;
        });
};