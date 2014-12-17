'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate'),
    logger = require('pine')(),
    crypto = require('../../lib/crypto'),
    uuid = require('node-uuid'),
    Token = require('./token'),
    payPalUser = require('./payPalUser');

var paypalDelegatedUserModel = function () {

    var paypalUserSchema = mongoose.Schema({
        name: String,
        profileId: String,
        // Encrypted with a cookie that is only stored on the original delegation link
        encrypted_refresh_token: String,
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

    paypalUserSchema.statics.login = function (req, res, info, cb) {
        mongoose.models.PayPalDelegatedUser.findById(info.id, req.$eat(function (delegate) {
            if (!delegate) {
                logger.error('Delegate login attempted for unknown delegate %s', info.id);
                return cb(new Error('Unknown delegate'));
            }
            delegate.decryptRefreshToken(info.uuid, info.password, function (err, rt, binKey) {
                if (err) {
                    return cb(new Error('Invalid delegate credentials.'));
                }
                // Now make a new token for them
                var token = new Token({
                    access_token: delegate.access_token,
                    last_used: new Date()
                });
                Token.encryptRefreshToken(rt, res, req.$eat(function (encToken) {
                    token.encrypted_refresh_token = encToken;
                    token.save(req.$eat(function () {
                        req.login({
                            delegate: delegate,
                            token: token
                        }, function (err) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, {
                                    delegate: delegate,
                                    key: binKey
                                });
                            }
                        });
                    }));
                }));
            });
        }));
    };

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

    paypalUserSchema.plugin(findOrCreate);

    return mongoose.model('PayPalDelegatedUser', paypalUserSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.PayPalDelegatedUser || new paypalDelegatedUserModel();
