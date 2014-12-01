'use strict';

var morgan = require('morgan');

// We want to replace the UUID value on query string with a placeholder for security purposes.
// Basically most secrets are stored in OUR db with a key that is given to the client side.
// That key is fed back with uuid argument, but if we log it it basically defeats the purpose
// of the security measure. The point of this is that if our db is hacked/stolen, it's still hard
// to harvest a bunch of secrets (usually refresh tokens) in bulk.
var badParams = /uuid=(.+[^0-9\-])/g;

exports = module.exports = function noUuidLogger(format, options) {
    morgan.token('url', function (req) {
        return req.logSafeUrl || req.url.replace(badParams, 'uuid=*');
    });
    var fn = morgan(format, options);
    return function (req, res, next) {
        console.log(req.url);
        fn(req, res, next);
    };
};