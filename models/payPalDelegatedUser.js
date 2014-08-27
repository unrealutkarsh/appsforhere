'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate'),
    crypto = require('../lib/crypto'),
    uuid = require('node-uuid'),
    payPalUser = require('./payPalUser');

var paypalDelegatedUserModel = function () {

    var paypalUserSchema = mongoose.Schema({
        name: String,
        profileId: String,
        // Encrypted with a cookie that is only stored on the original delegation link
        encrypted_refresh_token: String,
        access_token: String,
        email: String,
        currency: String,
        country: String,
        createDate: Date,
        lastLogin: Date,
        environment: String,
        allowedResources: [String]
    });

    paypalUserSchema.methods.hereApiUrl = payPalUser.schema.methods.hereApiUrl;
    paypalUserSchema.methods.hereApi = payPalUser.schema.methods.hereApi;

    paypalUserSchema.statics.encryptRefreshToken = function (token, pwd, cb) {
        var key = uuid.v4();
        crypto.encryptToken(token, key + pwd, function (e, tok) {
            if (e) {
                cb(e);
            } else {
                cb(null, {
                    token: tok,
                    key: key
                });
            }
        });
    };

    paypalUserSchema.methods.decryptRefreshToken = function (uuid, password, cb) {
        var key = uuid + password;
        if (!key) {
            cb(new Error('Invalid unique id during refresh token usage.'));
        } else {
            crypto.decryptToken(this.encrypted_refresh_token, key, function (err,rz,binKey) {
                cb(err,rz,binKey);
            });
        }
    };

    paypalUserSchema.statics.decryptRefreshTokenWithKey = function (request, cb) {
        var key = request.cookies.sessionkey;
        if (!key) {
            request.logout();
            cb(new Error('Invalid session guid during refresh token usage.'));
        } else {
            key = new Buffer(key, 'base64');
            crypto.decryptTokenWithKey(request.user.encrypted_refresh_token, key, function (err,rz) {
                if (err) {
                    request.logout();
                }
                cb(err,rz);
            });
        }
    };

    paypalUserSchema.plugin(findOrCreate);

    return mongoose.model('PayPalDelegatedUser', paypalUserSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.PayPalDelegatedUser || new paypalDelegatedUserModel();
