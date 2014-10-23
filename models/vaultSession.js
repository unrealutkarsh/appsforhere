'use strict';

var mongoose = require('mongoose');
var uuid = require('node-uuid');
var crypto = require('../lib/crypto');
var pki = require('node-forge').pki, rsa = pki.rsa;
var RSAKey = require('../lib/rsa');
var logger = require('pine')();

var keycache = [];

function fillKeys() {
    rsa.generateKeyPair({bits: 2048, e: 0x10001, workers: -1}, function (err, keypair) {
        if (err) {
            logger.error('Failed to generate cached keypair: %s', err.message);
        } else {
            keycache.push(keypair);
            if (keycache.length < 5) {
                fillKeys();
            }
        }
    });
}

function getKey(cb) {
    if (keycache.length) {
        var yours = keycache.pop();
        fillKeys();
        cb(null, yours);
    } else {
        logger.warn('Exhausted the keycache, generating one on demand.');
        // No need to re-fill because someone else already did.
        rsa.generateKeyPair({bits: 2048, e: 0x10001, workers: -1}, cb);
    }
}
fillKeys();

var vaultSessionModel = function () {

    var vaultSchema = mongoose.Schema({
        profileId: String,
        environment: String,
        publicKey: String,
        encryptedConfiguration: Buffer
    });

    vaultSchema.statics.createSession = function (req, cb) {
        getKey(function (err, keypair) {
            // keypair.privateKey, keypair.publicKey
            var doc = new mongoose.models.vaultSession({
                profileId: req.user.profileId,
                publicKey: keypair.publicKey.n.toString(16)
            });
            var key = uuid.v4();
            req.user.refresh_token(req.user, req.$eat(function (rt) {
                doc.encryptSecureConfiguration({
                    privateKey: pki.privateKeyToPem(keypair.privateKey)
                }, key, function (encError) {
                    if (encError) {
                        cb(encError);
                    } else {
                        doc.save(function (saveError) {
                            cb(saveError, {
                                session: doc,
                                key: key
                            });
                        });
                    }
                });
            }));
        });
    };

    vaultSchema.statics.getSession = function (id, cb) {
        mongoose.models.vaultSession.findById(id, function (err, doc) {
           cb(err,doc);
        });
    };

    vaultSchema.statics.decryptPayload = function (req, cb) {
        vaultSchema.statics.getSession(req.params.id, function (err, doc) {
           if (err) {
               cb(err);
               return;
           }
           doc.decryptSecureConfiguration(req.query.uuid, function (decErr, config) {
               var pk = pki.privateKeyFromPem(config.privateKey);
               var rsak = new RSAKey();
               rsak.setPrivate(pk.n.toString(16), '10001', pk.d.toString(16));
               var cleartext = rsak.decrypt(req.body.blob,'hex');
               cb(null, cleartext);
           });
        });
    };

    vaultSchema.methods.encryptSecureConfiguration = function (config, key, cb) {
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

    vaultSchema.methods.decryptSecureConfiguration = function (key, cb) {
        crypto.decryptToken(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    };

    vaultSchema.methods.decryptSecureConfigurationWithKey = function (key, cb) {
        crypto.decryptTokenWithKey(this.encryptedConfiguration, key, function (err, rz) {
            if (err) {
                cb(err);
            } else {
                cb(err, JSON.parse(rz));
            }
        });
    };
    return mongoose.model('vaultSession', vaultSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.vaultSession || new vaultSessionModel();