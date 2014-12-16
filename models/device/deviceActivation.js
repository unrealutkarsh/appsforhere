'use strict';

var mongoose = require('mongoose'),
    util = require('util'),
    crypto = require('../../lib/crypto'),
    findOrCreate = require('mongoose-findorcreate');

// Create a token generator with the default settings:
var randtoken = require('rand-token').generator({
    chars: '0123456789'
});

var deviceModel = function () {

    var deviceSchema = mongoose.Schema({
        profileId: {type: String, index: true},
        terminalId: String,
        activationCode: String,
        timestamp: { type: Date, default: Date.now },
        configuration: mongoose.Schema.Types.Mixed,
        encryptedConfiguration: Buffer,
        environment: String
    });

    deviceSchema.index({profileId: 1, environment: 2, terminalId: 3}, {unique: false});
    util._extend(deviceSchema.methods, require('../secureConfig'));

    deviceSchema.methods.generateAuthCode = function (uuid, cb) {
        var self = this, code;
        do {
            code = randtoken.generate(6);
        } while (code[0] === '0');
        crypto.encryptToken(uuid, code, function uuidCryptCallback(err, cipherText) {
            if (err) {
                cb(err);
            } else {
                self.activationCode = cipherText;
                cb(null, code);
            }
        });
    };

    deviceSchema.statics.getActivation = function (terminalId, code, cb) {
        mongoose.models.DeviceActivation.findOne()
            .where({
                terminalId: String(terminalId)
            })
            .sort({timestamp: -1})
            .exec(function (err, doc) {
                if (err) {
                    cb(err);
                    return;
                }
                crypto.decryptToken(doc.activationCode, String(code), function (cryptErr, cryptToken) {
                    if (cryptErr) {
                        cb(cryptErr);
                        return;
                    }
                    doc.uuid = cryptToken;
                    doc.decryptSecureConfiguration(cryptToken, function (decErr, config) {
                        doc.decryptedConfig = config;
                        cb(decErr, doc);
                    });
                });
            });
    };

    return mongoose.model('DeviceActivation', deviceSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.DeviceActivation || new deviceModel();