'use strict';
var logger = require('pine')(),
    appUtils = require('../lib/appUtils'),
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
                    logger.debug('Creating device room %s', dc.id);
                    req.deviceRooms = req.deviceRooms || {};
                    var roomName = 'device:' + dc.id;
                    req.deviceRooms[device.id] = roomName;
                    socket.emit('deviceRoom', {id: device.id, room: roomName});
                    socket.join(roomName, function (err) {
                        if (err) {
                            logger.error('%s\n%s', err.message, err.stack);
                            socket.emit('error', {
                                message: err.message
                            });
                        } else {
                            socket.in(roomName).emit('deviceUpdate', {
                                id: dc._id,
                                deviceId: dc.deviceid,
                                host: dc.host,
                                support: dc.support,
                                room: 'device:' + dc.id
                            });
                        }
                    });
                })
            );
        });
    });

    socket.on('deviceAttach', function (d) {
        var req = socket.request;
        if (!req.user || !req.user.profileId) {
            socket.emit('error', {message: 'Access denied'});
            return;
        }
        Device.findById(d.id, req.$eat(function (dev) {
            if (!dev) {
                socket.emit('error', {message: 'Device not found'});
                return;
            }
            Device.find({profileId: req.user.profileId, key: d.key}, req.$eat(function (perm) {
                if (!perm) {
                    socket.emit('error', {message: 'Access denied'});
                    return;
                }
                logger.debug('Joining device room %s', dev.id);
                socket.join('device:' + dev.id, function (err) {
                    if (err) {
                        logger.error('%s\n%s', err.message, err.stack);
                        socket.emit('error', {
                            message: err.message
                        });
                    } else {
                        socket.emit('deviceUpdate', {
                            id: dev._id,
                            deviceId: dev.deviceid,
                            host: dev.host,
                            support: dev.support,
                            room: 'device:' + dev.id
                        });
                    }
                })
            }));
        }));
    });

    socket.on('deviceSubscribed', function (d) {
        var req = socket.request;
        if (req.deviceRooms && req.deviceRooms[d.id]) {
            socket.to(req.deviceRooms[d.id]).emit('deviceSubscribed',d);
        }
    });

    socket.on('deviceSubscribe', function (d) {
        logger.debug('deviceSubscribe',d);
        var req = socket.request;
        if (!req.user || !req.user.profileId) {
            socket.emit('error', {message: 'Access denied'});
            return;
        }
        Device.findById(d.id, req.$eat(function (dev) {
            if (!dev) {
                socket.emit('error', {message: 'Device not found'});
                return;
            }
            Device.find({profileId: req.user.profileId, key: d.key}, req.$eat(function (perm) {
                if (!perm) {
                    socket.emit('error', {message: 'Access denied'});
                    return;
                }
                socket.to('device:'+dev._id).emit('deviceSubscribe',{
                    id: dev.deviceId,
                    subscription: d.subscription
                });
            }));
        }));
    });

    socket.on('devicePing', function (d) {
        socket.to(d.room).emit('devicePing', d);
    });

    socket.on('devicePong', function (d) {
        socket.to(d.room).emit('devicePong', d);
    });

    socket.on('deviceEvent', function (d) {
        var req = socket.request;
        if (req.deviceRooms && req.deviceRooms[d.id]) {
            logger.info('Forward deviceEvent %s for %s (%s)', d.type, d.id, req.deviceRooms[d.id]);
            socket.to(req.deviceRooms[d.id]).emit('deviceEvent', d);
        } else {
            logger.error('Received deviceEvent for unregistered device %s', d.id);
        }
    });
};
