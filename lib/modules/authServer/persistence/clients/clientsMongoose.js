const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const internals = {};

const clientSchema = new Schema({
    client_id: {type: String, required: true},
    client_secret: {type: String, required: true},
    redirect_uris: [{type: String, required: true}],
    active: {type: Boolean},
    created_at: Date,
    updated_at: Date
});

// Update timestamp on every save
// Cannot use ES6 arrow function, or this is incorrect
clientSchema.pre('save', function (next) {
    const current_date = new Date();
    this.updated_at = current_date;
    if (!this.created_at) {
        this.created_at = current_date;
    }
    next();
});

// TODO: update touch field on changes. Aka: pre on queries

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

internals.Client.prototype.find = function() {
    return this._client
        .find((clients) => {
            return clients
        }, (err) => {
            return err;
        });
};