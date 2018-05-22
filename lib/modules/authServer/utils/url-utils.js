/**
 * Crafted in Erebor by thorin on 2018-05-22
 */
const url = require('url');

module.exports.buildUrl = (base, options, hash) => {
    const newUrl = url.parse(base, true);
    delete newUrl.search;
    if (!newUrl.query) {
        newUrl.query = {};
    }

    Object.entries(options).forEach(([ key, value ]) => {
        newUrl.query[key] = value;
    });

    if (hash) {
        newUrl.hash = hash;
    }

    return url.format(newUrl);
};
