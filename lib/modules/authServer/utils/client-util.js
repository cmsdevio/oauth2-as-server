/* eslint-disable consistent-return */
module.exports.isClientValid = (client, redirectUri, clientId, clientSecret, grantType) => {
    if (!client) {
        console.error(`Unknown client ID ${ clientId }.`);
        return false;
    } else if (!client.isActive) {
        console.error(`Client ID ${ client.client_id } is inactive.`);
        return false;
    } else if (redirectUri.every(uri => client.redirect_uris.includes(uri))) {
        console.error(`Invalid redirect URI ${ redirectUri }.`);
        return false;
    } else if (clientSecret && clientSecret !== client.client_secret) {
        console.error(`Invalid client secret for ID ${ client.client_id }.`);
    } else if (grantType && client.grant_types.indexOf(grantType) === -1) {
        console.error(`Invalid grant type ${ grantType }.`);
        return false;
    } else {
        return true;
    }
};
