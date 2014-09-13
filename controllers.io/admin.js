'use strict';
var logger = require('pine')(),
    LogModel = require('../models/log'),
    appUtils = require('appUtils');

var ioServer = false;

module.exports = function (io, socket) {
    if (!ioServer) {
        setupLogStreaming(io);
    }
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

function setupLogStreaming(io) {
    var lastMsg, logStream;
    console.log('Setting up winston streaming');
    LogModel.where('timestamp').gte(new Date()).tailable().stream()
        .on('data',function (log) {
            if (lastMsg == String(log._id)) {
                // I have no idea why this happens, but it does.
                return;
            }
            lastMsg = String(log._id);
            try {
                io.sockets.in('logwatchers').emit('log', log);
            } catch (x) {
                // If we logged here... that'd be ironic.
            }
        }).on('error',function (e) {
            console.log('winston streaming error.', e.message);
            ioServer = null;
            // Prevent hammering the server
            setTimeout(function () {
                setupLogStreaming(io);
            }, 1000);
        }).on('close', function () {
            console.log('winston stream closed.');
            ioServer = null;
            // Prevent hammering the server
            setTimeout(function () {
                setupLogStreaming(io);
            }, 1000);
        });
    ioServer = io;
}