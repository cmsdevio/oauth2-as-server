const Randomstring = require('randomstring');

module.exports.generateToken = (length = 25) => {
    return Randomstring.generate(length);
};