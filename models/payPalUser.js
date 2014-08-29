'use strict';

var mongoose = require('mongoose'),
    appUtils = require('appUtils'),
    findOrCreate = require('mongoose-findorcreate'),
    crypto = require('../lib/crypto'),
    uuid = require('node-uuid');

var paypalUserModel = function () {

    var paypalUserSchema = mongoose.Schema({
        name: String,
        profileId: { type: String, unique: true },
        // Encrypted with a cookie that is only stored on the browser
        encrypted_refresh_token: String,
        access_token: String,
        email: String,
        currency: String,
        country: String,
        groups: [String],
        environment: String
    });

    paypalUserSchema.statics.encryptRefreshToken = function (token, response, cb) {
        var key = uuid.v4();
        response.cookie('sessionguid', key);
        crypto.encryptToken(token, key, cb);
    };
    paypalUserSchema.statics.decryptRefreshToken = function (request, cb) {
        var key = request.cookies.sessionguid;
        if (!key) {
            request.logout();
            cb(new Error('Invalid session guid during refresh token usage.'));
        } else {
            crypto.decryptToken(request.user.encrypted_refresh_token, key, function (err, rz) {
                if (err) {
                    request.logout();
                }
                cb(err, rz);
            });
        }
    };
    paypalUserSchema.methods.hereApiUrl = function (method, api) {
        return appUtils.hereApiUrl(this.environment, method, api);
    };

    paypalUserSchema.methods.hereApi = function () {
        return appUtils.hereApi(this.environment);
    };

    paypalUserSchema.plugin(findOrCreate);

    return mongoose.model('PayPalUser', paypalUserSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.PayPalUser || new paypalUserModel();
