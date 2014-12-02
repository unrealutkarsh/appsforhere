'use strict';

var logger = require('pine')();
var appUtils = require('appUtils');
var Device = require('../models/device/device');
var DevicePermission = require('../models/device/devicePermission');
var DevicePreference = require('../models/device/devicePreference');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/all')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .get(function (req, res) {
            devicesForUser(req, req.user.profileId, function (devs) {
               res.json({devices:devs});
            });
        });

    router.route('/add')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .get(function (req, res) {
            Device.find({key:req.query.uuid}, req.$eat(function (devs) {
                // Now add this to the permissions list
                if (devs && devs.length > 0) {
                    DevicePermission.findOrCreate({profileId:req.user.profileId,key:req.query.uuid},
                    req.$eat(function () {
                        res.json({
                            ok:true,
                            devices:devs
                        });
                    }));
                } else {
                    res.json({ok:false,error:'No devices found.'});
                }
            }));
        });

    router.route('/preferences/:id')
        .all(appUtils.auth)
        .all(appUtils.hasRoles(appUtils.ROLES.ManageHardware))
        .post(function (req, res) {
            Device.findById(req.params.id, req.$eat(function (doc) {
                DevicePermission.findOne({profileId:req.user.profileId,key:doc.key}, req.$eat(function (perm) {
                    if (!perm) {
                        res.status(401).json({ok:false});
                    } else {
                        DevicePreference.findOrCreate({permissionId:perm._id, deviceId:doc.deviceId},
                            {name:req.body.name},
                            {upsert:true},
                        req.$eat(function () {
                            res.json({ok:true});
                        }));
                    }
                }));
            }));
        });

};

function devicesForUser(req, profileId, cb) {
    DevicePermission
        .find({profileId:profileId})
        .exec(req.$eat(function (perms) {
            if (perms && perms.length) {
                var keys = [], ids = [];
                perms.forEach(function (f) {
                    keys.push(f.key);
                    ids.push(f._id);
                });
                DevicePreference.find({permissionId:{$in:ids}}, req.$eat(function (prefs) {
                    var pmap = preferenceMap(perms, prefs);
                    Device.find({key:{$in:keys}}, req.$eat(function (devs) {
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
    console.log("PMAP",ret);
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
