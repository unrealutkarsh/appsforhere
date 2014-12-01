'use strict';
var logger = require('pine')(),
    appUtils = require('appUtils');

module.exports = function (io, socket) {
    /**
     * The deviceInterface command tells us that the connected socket is a device interface and makes a room for it
     */
    socket.on('deviceInterface', function (d) {
        var req = socket.request;
        if (!req.user) {
            socket.emit('error', {message: 'Access denied'});
            return;
        }
        if (!d.deviceId) {
            socket.emit('error', {message: 'deviceInterface requires a deviceId'});
            return;
        }
        socket.join('device:' + d.deviceId,     function (err, rz) {
            if (err) {
                logger.error('%s\n%s', err.message, err.stack);
                socket.emit('error', {
                    message: err.message
                });
            } else {
                socket.emit('deviceInterface', {ready: true});
            }
        });
    });
};
