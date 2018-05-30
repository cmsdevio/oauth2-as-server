/* eslint-disable no-unused-vars,no-param-reassign */
/**
 * Crafted in Erebor by thorin on 2017-11-28
 */
const meta = require('./package');

exports.plugin = {
    register: (server, options) => {
        // *********************************
        // DB MOCK CODE
        // *********************************
        const client1 = {
            client_name: 'restlet_client_5327',
            response_types: [ 'token' ],
            token_endpoint_auth_method: 'client_secret_basic',
            client_id: '9WBlEWnkLSwkcsTXI97bHfhx5joxleogWyKfGKni325Fewq10I',
            client_secret: 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4',
            client_id_created_at: 1513791723,
            client_secret_expires_at: 0,
            isActive: true,
            grant_types: [ 'client_credentials' ],
            redirect_uris: [ 'http://localhost:1234/dummy' ]
        };
        const client2 = {
            client_name: 'restlet_client_5327',
            response_types: [ 'code' ],
            token_endpoint_auth_method: 'client_secret_basic',
            client_id: 'v30UYVDty9P1D3g7yxCEdzzF9WzrKmKWQODy7EuAU4jGE5JlDf',
            client_secret: 't6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4t6nadULs7u3hLDDmC2JzCuQJEFCxxRMthXMIF57OJhGTXm9nM4',
            client_id_created_at: 1513791723,
            client_secret_expires_at: 0,
            isActive: true,
            scopes: [ 'foo', 'bar', 'fubar' ],
            grant_types: [ 'authorization_code' ],
            redirect_uris: [ 'http://localhost:1234/dummy' ]
        };
        const clientsMap = new Map();
        clientsMap.set(client1.client_id, client1);
        clientsMap.set(client2.client_id, client2);

        const codesMap = new Map();

        server.app.db = {
            saveClient: newClient => new Promise((resolve, reject) => {
                if (!newClient.isActive) {
                    newClient.isActive = true;
                }
                console.log(`Saving new client: ${ newClient }`);
                clientsMap.set(newClient.client_id, newClient);
                resolve(client1);
            }),
            findClientById:
                    clientId => new Promise((resolve, reject) => resolve(clientsMap.get(clientId))),
            saveCode: code => new Promise((resolve, reject) => {
                console.log(`Saving code object with key ${ code.code }.`);
                codesMap.set(code.code, code);
                resolve(code);
            }),
            findCodeByValue: value => new Promise((resolve, reject) => resolve(codesMap.get(value)))
        };
    },
    pkg: meta
};
