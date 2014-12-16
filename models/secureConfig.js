'use strict';
var crypto = require('../lib/crypto');

module.exports = {

    encryptSecureConfiguration: function (config, key, cb) {
        var self = this;
        crypto.encryptToken(JSON.stringify(config), key, function (err, enc) {
            if (err) {
                cb(err);
            } else {
                self.encryptedConfiguration = new Buffer(enc, 'base64');
                cb();
            }
        });
    },

    decryptSecureConfiguration: function (key, cb) {
        crypto.decryptToken(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    },

    decryptSecureConfigurationWithKey: function (key, cb) {
        crypto.decryptTokenWithKey(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    }
};