'use strict';
var logger = require('pine')(),
    LogModel = require('../models/log'),
    appUtils = require('../lib/appUtils');

module.exports = function (io, socket) {
    /**
     * The joinLogs command puts the socket in the room that receives all server log messages
     */
    socket.on('joinLogs', function (d) {
        var req = socket.request;
        if (!req.user.groups || req.user.groups.indexOf('admin') < 0) {
            socket.emit('error', {message: 'Access denied'});
            return;
        }
        if (d && d.on === false) {
            socket.leave('logwatchers');
            logger.debug('%s left logwatchers room', socket.id);
        } else {
            socket.join('logwatchers', function (err, rz) {
                if (err) {
                    logger.error('%s\n%s', err.message, err.stack);
                    socket.emit('error', {
                        message: err.message
                    });
                } else {
                    logger.debug('%s joined logwatchers room', socket.id);
                    socket.emit('joinedLogs', {on: true});
                }
            });
        }
    });
};
