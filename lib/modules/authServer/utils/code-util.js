module.exports.isCodeValid = (code, value, client_id) => {
    const today = new Date();
    if (!code) {
        console.error(`Unknown code ${value}.`);
        return false;
    } else if (code.client_id !== client_id) {
        console.error(`Mis-matching client ID. Got ${code.client_id}, expected ${client_id}.`);
        return false;
    } else if (code.ttl < today) {
        console.error(`Code ${code.code} expired on ${code.ttl}.`);
        return false;
    }
    return true;
};