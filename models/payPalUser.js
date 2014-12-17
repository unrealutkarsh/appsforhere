'use strict';

var mongoose = require('mongoose'),
    appUtils = require('../lib/appUtils'),
    findOrCreate = require('mongoose-findorcreate'),
    crypto = require('../lib/crypto'),
    uuid = require('node-uuid');

var paypalUserModel = function () {

    var paypalUserSchema = mongoose.Schema({
        name: String,
        profileId: { type: String, unique: true },
        email: String,
        currency: String,
        country: String,
        groups: [String],
        environment: String
    });

    paypalUserSchema.methods.hereApiUrl = function (method, api) {
        // Somehow, "request" is this here...
        var user = this;
        if (user.user) {
            user = user.user;
        }
        return appUtils.hereApiUrl(user.environment, method, api);
    };

    paypalUserSchema.methods.hereApi = function () {
        // Somehow, "request" is this here...
        var user = this;
        if (user.user) {
            user = user.user;
        }
        return appUtils.hereApi(user.environment);
    };

    paypalUserSchema.plugin(findOrCreate);

    return mongoose.model('PayPalUser', paypalUserSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.PayPalUser || new paypalUserModel();
