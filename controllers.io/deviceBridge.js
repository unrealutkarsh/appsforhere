'use strict';
var logger = require('pine')(),
    appUtils = require('appUtils'),
    Device = require('../models/device/device');

module.exports = function (io, socket) {
    /**
     * The deviceInterface command tells us that the connected socket is a device interface and makes a room for it
     */
    socket.on('advertiseDevices', function (d) {
        var req = socket.request;

        if (!d.devices) {
            socket.emit('error', {message: 'advertiseDevices requires a devices array'});
            return;
        }
        d.devices.forEach(function (device) {
            Device.findOrCreate({
                    key: d.key,
                    deviceId: device.id
                },
                {
                    support: device.support,
                    host: d.host
                },
                { upsert: true },
                req.$eat(function (dc) {
                    logger.debug('Creating device room %s', device.id);
                    socket.join('device:' + device.id, function (err, rz) {
                        if (err) {
                            logger.error('%s\n%s', err.message, err.stack);
                            socket.emit('error', {
                                message: err.message
                            });
                        }
                    });
                })
            );
        });
    });
};
