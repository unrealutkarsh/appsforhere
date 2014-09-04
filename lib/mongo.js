'use strict';

var mongoose = require('mongoose');
var logger = require('pine')();

var db = function () {
    var self = {
        config: function (connStr) {
            mongoose.connect(connStr, {auth_reconnect: true, native_parser: true});
            self.db = mongoose.connection.db;
            mongoose.connection.on('error', function (e) {
                logger.error('Mongo connection error: %s\n%s', e.toString(), e.stack);
            });
            mongoose.connection.once('connected', function callback() {
                logger.debug('Mongo connection established.');
            });
        }
    };
    return self;
};
module.exports = db();