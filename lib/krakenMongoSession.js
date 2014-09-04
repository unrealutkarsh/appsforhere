'use strict';

var mongo = require('./mongo');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

module.exports = function mongosession(settings, settingsConfig) {
    settings.store = new MongoStore({
        db: mongo.db
    });
    return session(settings);
};