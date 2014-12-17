'use strict';

var mongoose = require('mongoose'),
    appUtils = require('../lib/appUtils'),
    findOrCreate = require('mongoose-findorcreate'),
    crypto = require('../lib/crypto'),
    uuid = require('node-uuid');

var tokenModel = function () {

    var tokenSchema = mongoose.Schema({
        // Encrypted with a cookie that is only stored on the browser
        encrypted_refresh_token: String,
        // TODO consider putting this in session and just dumping it from our mainline db entirely
        access_token: String,
        // Expire this entry after two weeks of non-use
        last_used: { type:Date, expires: '14d' }
    });

    tokenSchema.statics.encryptRefreshToken = function (token, response, cb) {
        var key = uuid.v4();
        response.cookie('tokenguid', key);
        crypto.encryptToken(token, key, cb);
    };
    tokenSchema.statics.decryptRefreshToken = function (request, cb) {
        var key = request.cookies.tokenguid;
        if (!key) {
            request.logout();
            cb(new Error('Invalid token guid during refresh token usage.'));
        } else {
            crypto.decryptToken(request.user.token.encrypted_refresh_token, key, function (err, rz) {
                if (err) {
                    request.logout();
                }
                cb(err, rz);
            });
        }
    };

    return mongoose.model('Token', tokenSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.Token || new tokenModel();
