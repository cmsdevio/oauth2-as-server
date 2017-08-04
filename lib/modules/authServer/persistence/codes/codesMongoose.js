const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const internals = {};

const codeSchema = new Schema({
    value: {type: String, required: true},
    client_id: {type: String, required: true},
    redirect_uri: {type: String, required: true},
    state: {type: String, required: true},
    scope: {type: String},
    ttl: Date
}, { timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
}
});

exports = module.exports = internals.Code = function() {
    this._code = Mongoose.model('Code', codeSchema);
};

internals.Code.prototype.save = function() {
    // Check first that no code exists for the client_id and redirect_uri combination

    this._code.save((err, code) => {
        if (err) return console.error(err);
        return code;
    });
};

internals.Code.prototype.create = function(data) {
    return new this._code(data);
};

internals.Code.prototype.findByValue = function(code) {
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
};

internals.Code.prototype.findByClientId = function(clientId) {
    return this._code
        .findOne({client_id: clientId})
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
};

internals.Code.prototype.delete = function(clientId) {
    return this._code
        .find({client_id: clientId})
        .remove()
        .then((codes) => {
            return codes;
        }, (err) => {
            return err;
        });
};

internals.Code.prototype.findAndDelete = function(value) {
    return this._code
        .findOneAndRemove({value: value})
        .then((code) => {
            return code;
        }, (err) => {
            return err;
        });
};