'use strict';

var logger = require('pine')();
var appUtils = require('appUtils');
var Device = require('../models/device/device');
var DevicePermission = require('../models/device/devicePermission');

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

};

function devicesForUser(req, profileId, cb) {
    DevicePermission
        .find({profileId:profileId})
        .exec(req.$eat(function (perms) {
            if (perms && perms.length) {
                var keys = [];
                perms.forEach(function (f) {
                    keys.push(f.key);
                });
                Device.find({key:{$in:keys}}, req.$eat(function (devs) {
                    if (devs && devs.length) {
                        for (var i = 0; i < devs.length; i++) {
                            devs[i] = cleanDevice(devs[i]);
                        }
                    }
                    console.log(devs);
                    cb(devs);
                }));
            } else {
                cb([]);
            }
        }));

}

function cleanDevice(d) {
    return {
        id: d.deviceId,
        host: d.host,
        support: d.support
    };
}