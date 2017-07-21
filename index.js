const Confidence = require('confidence');
const Glue = require('glue');
const config = require('./config');

const store = new Confidence.Store(config);
const Manifest = store.get('/', { env: process.env.NODE_ENV });
const options = { relativeTo: __dirname };

Glue.compose(Manifest, options, (err, server) => {
    if (err) {
        throw err;
    }

    server.start((error) => {
        if (error) {
            throw error;
        }
        console.log(`Server started...`);
    });
});
