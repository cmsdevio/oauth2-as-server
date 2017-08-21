module.exports.isClientValid = (client, redirect_uri, client_id, client_secret, grant_type) => {
    if (!client) {
        console.error(`Unknown client ID ${client_id}.`);
        return false;
    } else if (!client.active) {
        console.error(`Client ID ${client.client_id} is inactive.`);
        return false;
    } else if (redirect_uri && client.redirect_uris.indexOf(redirect_uri) === -1) {
        console.error(`Invalid redirect URI ${redirect_uri}.`);
        return false;
    } else if (client_secret && client_secret !== client.client_secret) {
        console.error(`Invalid client secret for ID ${client.client_id}.`);
    } else if (grant_type && client.grant_types.indexOf(grant_type) === -1) {
        console.error(`Invalid grant type ${grant_type}.`);
        return false;
    } else {
        return true;
    }
};