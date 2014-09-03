'use strict';

var mongo = require('./mongo');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

module.exports = function mongosession(settings, settingsConfig) {
    settings.store = new MongoStore({
        mongoose_connection: mongo.db
    });
    return session(settings);
};