'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate'),
    crypto = require('../lib/crypto'),
    uuid = require('node-uuid'),
    Liwp = require('node-liwp');

var hereapis = {
    live: new Liwp({
        appId: process.env.PAYPAL_APP_ID,
        secret: process.env.PAYPAL_APP_SECRET
    }),
    sandbox: new Liwp({
        appId: 'AeoOpBB2XJWwORPT8Q7NpPQgr8eStz39tt8IsM6wRaxiRg50hdMTSgNk7rFg',
        secret: 'EDZTDBAH7SoQsPZxVAJ4n7SvVfMwWGziwLpJsvKj8Ghe8Wxm1Hg70Tt2pXP7'
    })
};

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
        if (!this.environment || this.environment === 'live') {
            if (api === 'payments') {
                return 'https://api.paypal.com/v1/payments/' + method;
            }
            return 'https://api.paypal.com/retail/merchant/v1/' + method;
        } else if (this.environment === 'sandbox') {
            if (api === 'payments') {
                return 'https://api.sandbox.paypal.com/v1/payments/' + method;
            }
            return 'https://api.sandbox.paypal.com/retail/merchant/v1/' + method;
        }
    };

    paypalUserSchema.methods.hereApi = function () {
        if (!this.environment || this.environment === 'live') {
            return hereapis.live;
        } else if (this.environment === 'sandbox') {
            return hereapis.sandbox;
        }
    };

    paypalUserSchema.plugin(findOrCreate);

    return mongoose.model('PayPalUser', paypalUserSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.PayPalUser || new paypalUserModel();
