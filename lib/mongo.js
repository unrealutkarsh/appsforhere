'use strict';

var mongoose = require('mongoose');
var logger = require('pine')();

var db = function () {
    var self = {
        config: function (connStr) {
            mongoose.connect(connStr);
            var db = this.db = self.db = mongoose.connection;
            db.on('error', function (e) {
                logger.error('Mongo connection error: %s', e.toString());
            });
            db.once('connected', function callback() {
                logger.debug('Mongo connection established.');
            });
        },
        connection: function () {
            return mongoose.connection;
        }
    };
    return self;
};
module.exports = db();