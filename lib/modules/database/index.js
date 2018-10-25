/**
 * Crafted in Erebor by thorin on 2017-11-28
 */
const meta = require('./package');
// const ObjectID = require('mongodb').ObjectID;
const Mongoose = require('mongoose');
const Promise = require('bluebird');
const Models = require('./persistence/mongodb/models');

exports.plugin = {
    register: async (server) => {
        // *********************************
        // Mongoose configuration
        // *********************************
        Mongoose.Promise = Promise;
        Mongoose.set('debug', 'true');
        const mongoConnectionUri = process.env.MONGO_URI || 'mongodb://localhost/Oauth2';
        await Mongoose.connect(mongoConnectionUri);
        // eslint-disable-next-line no-param-reassign
        server.app.db = Models;
    },
    pkg: meta
};
