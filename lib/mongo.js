/*───────────────────────────────────────────────────────────────────────────*\
 │  Copyright (C) 2014 eBay Software Foundation                               │
 |                                                                            |
 | yyyyyyyyyyyysssssssssss+++osssssssssssyyyyyyyyyyyy                         |
 | yyyyyysssssssssssssss/----../sssssssssssssssyyyyyy                         |
 | sysssssssssssssssss/--:-`    `/sssssssssssssssssys                         |
 | sssssssssssssssso/--:-`        `/sssssssssssssssss   AppsForHere           |
 | sssssssssssssso/--:-`            `/sssssssssssssss                         |
 | sssssssssssso/-::-`                `/sssssssssssss   Advanced integration  |
 | sssssssssso/-::-`                    `/sssssssssss   for PayPal Here and   |
 | sssssssso/-::-`                        `/sssssssss   the PayPal retail     |
 | ssssoso:-::-`                            `/osossss   family of products.   |
 | osooos:-::-                                -soooso                         |
 | ooooooo:---.``````````````````````````````.+oooooo                         |
 | oooooooooooooooooooooooooooooooooooooooooooooooooo                         |
 \*───────────────────────────────────────────────────────────────────────────*/
'use strict';

var mongoose = require('mongoose');
var logger = require('pine')();
var domain = require('domain');

var db = function () {
    var self = {
        config: function (connStr) {
            if (GLOBAL._hasShutdown) {
                logger.error('Attempting to reconnect to Mongo after process shutdown has begun.');
                return;
            }
            var d = domain.create();
            d.on('error', function (e) {
                logger.error('Mongo related error: %s\n%s', e.toString(), e.stack);
            });
            d.run(function () {
                mongoose.connect(connStr, {auth_reconnect: true, native_parser: true});
                self.db = mongoose.connection.db;
                self.connection = mongoose.connection;
                mongoose.connection.once('connected', function callback() {
                    logger.debug('Mongoose connection established.');
                });
            });
        }
    };
    return self;
};
module.exports = db();
