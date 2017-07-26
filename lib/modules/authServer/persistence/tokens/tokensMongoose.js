const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const internals = {};

const tokenSchema = new Schema({
    value: {type: String, required: true},
    client_id: {type: String, required: true},
    type: {type: String, required: true},
    state: {type: String, required: true},
    created_at: Date,
    ttl: Date
});

// Update timestamp on every save
// Cannot use ES6 arrow function, or this is incorrect
tokenSchema.pre('save', function (next) {
    const current_date = new Date();
    this.updated_at = current_date;
    if (!this.created_at) {
        this.created_at = current_date;
    }
    if (!this.ttl) {
        this.ttl = current_date.getDate() + 1;
    }
    next();
});

// TODO: update touch field on changes. Aka: pre on queries

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

/*internals.Code.prototype.findByValue = function(code) {
    return this._code
        .find({value: code})
        .then((code) => {
            if (!Array.isArray(code) || (Array.isArray(code) && code.length !== 1)) {
                console.error(`Unknown code ${code}.`);
                return null;
            } else {
                return code.shift();
            }
        }, (err) => {
            return err;
        });
};*/

/*internals.Client.prototype.findByClientId = function(clientId) {
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

*/