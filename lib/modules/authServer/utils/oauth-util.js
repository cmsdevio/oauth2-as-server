const _ = require('lodash');

module.exports.isScopeValid = (reqScope, authScope) => {
    return _.difference(reqScope, authScope).length <= 0;
};

module.exports.determineScope = (reqScope, payload) => {
    const scope = [];
    reqScope.forEach(aScope => {
        if (payload[aScope]) {
            scope.push(aScope);
        }
    });
    return scope.length > 0 ? scope.join('') : '';
};