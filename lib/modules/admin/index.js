const meta = require('./package');
const Path = require('path');

// TODO: put validation schema back in this file
exports.plugin = {
    register: (server) => {
        server.route({
            method: 'GET',
            path: '/admin/{param*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, 'public')
                }
            },
            options: {
                auth: false
            }
        });
    },
    pkg: meta
};
