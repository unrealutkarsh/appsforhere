'use strict';
var appUtils = require('appUtils');

module.exports = function (socket) {
    socket.on('logs', function (d) {
        var req = socket.request;
        if (!req.user.groups || req.user.groups.indexOf('admin') < 0) {
            socket.emit('error', {message: 'Access denied'});
            return;
        }
        console.log(d, socket.request.user);
    });
};
