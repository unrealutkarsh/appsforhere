'use strict';

var mongo = require('./mongo');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

module.exports = function mongosession(settings, settingsConfig) {
    module.exports.store = settings.store = new MongoStore({
        db: mongo.db
    });
    return session(settings);
};
