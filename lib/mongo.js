'use strict';

var mongoose = require('mongoose');
var logger = require('pine')();

var db = function () {
    var self = {
        config: function (connStr) {
            mongoose.connect(connStr, {auth_reconnect: true, native_parser: true});
            var db = this.db = self.db = mongoose.connection;
            db.on('error', function (e) {
                logger.error('Mongo connection error: %s\n%s', e.toString(), e.stack);
                console.log(db.openCalled);
            });
            db.once('connected', function callback() {
                logger.debug('Mongo connection established.');
            });
        }
    };
    return self;
};
module.exports = db();