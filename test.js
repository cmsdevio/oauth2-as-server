const Crypto = require('crypto');

const token = Crypto
    .randomBytes(256)
    .createHash('sha1')
    .toString('base64');
console.log(token);