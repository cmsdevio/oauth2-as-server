const meta = require('./package');
const Path = require('path');
const Handlebars = require('handlebars');

exports.register = (server, options, next) => {
    server.views({
        engines: { hbs: Handlebars },
        relativeTo: __dirname,
        path: Path.join(__dirname, 'views'),
        layoutPath: Path.join(__dirname, 'views/layout'),
        layout: true,
        isCached: false,
        partialsPath: Path.join(__dirname, 'views/partials'),
    });

    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: Path.join(__dirname, 'public')
            }
        }
    });

    const clients = [
        {
            client_id: 'client-id-1',
            client_secret: 'client-secret-1',
            redirect_uris: 'http://foo.com/bar'
        }
    ];

    server.route({
        method: 'GET',
        path: '/clients',
        handler: (request, reply) => {
            reply.view('clients', {
                clients: clients
            })
        }
    });

    next();
};

exports.register.attributes = {
    pkg: meta,
};