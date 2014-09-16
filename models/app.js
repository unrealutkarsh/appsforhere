'use strict';

var mongoose = require('mongoose'),
    crypto = require('../lib/crypto');

var appModel = function () {

    var appSchema = mongoose.Schema({
        name: String,
        profileId: String,
        applicationType: String,
        environment:String,
        configuration: mongoose.Schema.Types.Mixed,
        encryptedConfiguration: Buffer
    });

    appSchema.methods.encryptSecureConfiguration = function (config, key, cb) {
        var self = this;
        crypto.encryptToken(JSON.stringify(config), key, function (err, enc) {
            if (err) {
                cb(err);
            } else {
                self.encryptedConfiguration = new Buffer(enc, 'base64');
                cb();
            }
        });
    };

    appSchema.methods.decryptSecureConfiguration = function (key, cb) {
        crypto.decryptToken(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    };

    appSchema.methods.decryptSecureConfigurationWithKey = function (key, cb) {
        crypto.decryptTokenWithKey(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    };

    return mongoose.model('CheckinApp', appSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.CheckinApp || new appModel();