'use strict';

var mongo = require('./mongo');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

module.exports = function mongosession(settings, settingsConfig) {
    module.exports.settings = settings;
    module.exports.store = settings.store = new MongoStore({
        db: mongo.db,
        auto_reconnect: true
    });
    return session(settings);
};
