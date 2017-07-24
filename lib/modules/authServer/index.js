const meta = require('./package');
const Boom = require('boom');
const Joi = require('joi');
const Mongoose = require('mongoose');
const Schema = Mongoose.Schema;

// Use native promises
Mongoose.Promise = global.Promise;
Mongoose.set('debug', "true");
Mongoose.connect('mongodb://localhost/Oauth2');

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
    if (!this.completed) {
        this.completed = false;
    }
    if (!this.priority) {
        this.priority = false;
    }
    console.log(this);
    next();
});

// TODO: update touch field on changes. Aka: pre on queries

const Client = Mongoose.model('Client', clientSchema);

exports.register = (server, options, next) => {
    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            const filter = {};
            if (request.query.client_id) {
                filter.client_id = request.query.client_id;
            }

            Client.find(filter, (err, clients) => {
                if (err) return console.error(err);
                if (Array.isArray(clients) && clients.length === 1) {
                    reply({client: clients.shift()});
                } else {
                    reply({clients: clients});
                }

            });
        }
    });

    server.route({
        method: 'POST',
        path: '/clients',
        handler: (request, reply) => {
            let newClient = new Client(request.payload);
            // Save the object
            newClient.save((err, newClient) => {
                if (err) return console.error(err);
                reply({success: true});
            });
        },
        // config: {
        //     validate: {
        //         payload: {
        //             client_id: Joi.string().max(250).required(),
        //             client_secret: Joi.string().max(250).required(),
        //             active: Joi.boolean()
        //         }
        //     }
        // }
    });



    next();
};

exports.register.attributes = {
    pkg: meta,
};



