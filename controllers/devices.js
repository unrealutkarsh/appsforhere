'use strict';

var logger = require('pine')();
var uuid = require('uuid');
var appUtils = require('../lib/appUtils');
var Device = require('../models/device/device');
var DevicePermission = require('../models/device/devicePermission');
var DevicePreference = require('../models/device/devicePreference');
var DeviceActivation = require('../models/device/deviceActivation');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/all')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .get(function (req, res) {
            devicesForUser(req, req.user.profileId, function (devs) {
                res.json({devices: devs});
            });
        });

    router.route('/all/:locationId')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .get(function (req, res) {
            // Right now we don't support location-specific hardware anyways
            devicesForUser(req, req.user.profileId, function (devs) {
                res.json({devices: devs});
            });
        });

    router.route('/add')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .get(function (req, res) {
            Device.find({key: req.query.uuid}, req.$eat(function (devs) {
                // Now add this to the permissions list
                if (devs && devs.length > 0) {
                    DevicePermission.findOrCreate({profileId: req.user.profileId, key: req.query.uuid},
                        req.$eat(function () {
                            res.json({
                                ok: true,
                                devices: devs
                            });
                        }));
                } else {
                    res.json({ok: false, error: 'No devices found.'});
                }
            }));
        });

    router.route('/preferences/:id')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .post(function (req, res) {
            Device.findById(req.params.id, req.$eat(function (doc) {
                DevicePermission.findOne({profileId: req.user.profileId, key: doc.key}, req.$eat(function (perm) {
                    if (!perm) {
                        res.status(401).json({ok: false});
                    } else {
                        DevicePreference.findOrCreate({permissionId: perm._id, deviceId: doc.deviceId},
                            {name: req.body.name},
                            {upsert: true},
                            req.$eat(function () {
                                res.json({ok: true});
                            }));
                    }
                }));
            }));
        });

    router.route('/activate')
        .all(appUtils.apiAuth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .post(function (req, res) {
            // Need to get the refresh token to save to the new app. Since it's encrypted,
            // we need the 'middleware' to decrypt it using the uuid key in the session
            req.user.refresh_token(req.user, req.$eat(function (rt) {
                var key = uuid.v4();
                var activation = new DeviceActivation({
                    profileId: req.user.profileId,
                    terminalId: req.body.deviceCode,
                    configuration: {
                        application: req.body.application,
                        location: req.body.location,
                        access_token: req.user.access_token
                    }
                });
                activation.generateAuthCode(key, req.$eat(function (code) {
                    activation.encryptSecureConfiguration({
                        refresh_token: rt,
                        email: req.user.email
                    }, key, req.$eat(function onEncryptionComplete() {
                        activation.save(req.$eat(function onActivationSaved() {
                            res.render('devices/activate', {
                                code: code,
                                terminalId: activation.terminalId
                            });
                        }));
                    }));
                }));
            }));
        });

    router.route('/activate/:terminalId')
        .post(function (req, res) {
            try {
                DeviceActivation.getActivation(req.params.terminalId, req.body.code, req.$eat(function foundActivation(doc) {
                    res.json({
                        uuid: doc.uuid,
                        id: doc._id,
                        email: doc.decryptedConfig.email,
                        application: doc.configuration.application,
                        location: doc.configuration.location
                    });
                }));
            } catch (x) {
                console.log(x);
            }
        });

};

function devicesForUser(req, profileId, cb) {
    DevicePermission
        .find({profileId: profileId})
        .exec(req.$eat(function (perms) {
            if (perms && perms.length) {
                var keys = [], ids = [];
                perms.forEach(function (f) {
                    keys.push(f.key);
                    ids.push(f._id);
                });
                DevicePreference.find({permissionId: {$in: ids}}, req.$eat(function (prefs) {
                    var pmap = preferenceMap(perms, prefs);
                    Device.find({key: {$in: keys}}, req.$eat(function (devs) {
                        if (devs && devs.length) {
                            for (var i = 0; i < devs.length; i++) {
                                devs[i] = cleanDevice(devs[i]);
                                if (pmap[devs[i].id]) {
                                    devs[i].name = pmap[devs[i].id].name;
                                }
                            }
                        }
                        cb(devs);
                    }));
                }));
            } else {
                cb([]);
            }
        }));

}

function preferenceMap(perms, prefs) {
    var ret = {};
    if (prefs) {
        for (var i = 0; i < prefs.length; i++) {
            // TODO deviceId not specific enough
            ret[prefs[i].deviceId] = prefs[i];
        }
    }
    return ret;
}

function cleanDevice(d) {
    return {
        id: d.deviceId,
        host: d.host,
        support: d.support,
        _id: d._id.toString()
    };
}
