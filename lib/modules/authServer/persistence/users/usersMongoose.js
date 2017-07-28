const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

const internals = {};


const userSchema = new Schema({
    email: {type: String, required: true},
    password: {type: String, required: true},
    active: {type: Boolean},
    role: {type: String},
    created_at: Date,
    updated_at: Date
});

// Update timestamp on every save
// Cannot use ES6 arrow function, or this is incorrect
userSchema.pre('save', function (next) {
    const current_date = new Date();
    this.updated_at = current_date;
    if (!this.created_at) {
        this.created_at = current_date;
    }
    if (!this.active) {
        this.active = true;
    }
    if (!this.role) {
        this.role = 'user';
    }
    next();
});

// TODO: update touch field on changes. Aka: pre on queries

exports = module.exports = internals.User = function() {
    this._user = Mongoose.model('User', userSchema);
};

internals.User.prototype.findByEmail = function(email) {
    return this._user
        .find({email: email})
        .then((user) => {
            if (!Array.isArray(user) || (Array.isArray(user) && user.length !== 1)) {
                console.error(`Unknown client email ${email}.`);
                return null;
            } else {
                return user.shift();
            }
        }, (err) => {
            return err;
        });
};

internals.User.prototype.find = function() {
    return this._user
        .find((users) => {
            return users
        }, (err) => {
            return err;
        });
};

/*internals.User.prototype.save = function() {
    return this._user
        .save((user) => {
            return user;
        }, (err) => {
            return err;
        });
};*/

internals.User.prototype.create = function(data) {
    return new this._user(data);
};