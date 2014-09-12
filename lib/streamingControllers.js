'use strict';
var fs = require('fs'),
    path = require('path'),
    finder = require('findit'),
    passportSocketIo = require('passport.socketio'),
    logger = require('pine')();

module.exports = function (io, sessionStore, cookieParser) {
    var controllers = [], ready = false;
    var controllerEmitter = finder(path.resolve(__dirname,'../streamingControllers'));

    controllerEmitter.on('file', function (f) {
        console.log(f);
        if (path.extname(f).toLowerCase() === '.js') {
            var reqpath = path.relative(__dirname,f);
            logger.debug('Loading streamingController at %s', reqpath);
            controllers.push(require(reqpath));
        }
    });

    controllerEmitter.on('end', function () {
        logger.debug('Completed streamingController setup (%d).', controllers.length);
        ready = true;
    });

    io.use(passportSocketIo.authorize({
        cookieParser: require('cookie-parser'),
        key:         'express.sid',       // the name of the cookie where express/connect stores its session_id
        secret:      'session_secret',    // the session_secret to parse the cookie
        store:       require('./krakenMongoSession').store,        // we NEED to use a sessionstore. no memorystore please
        success:     onAuthorizeSuccess,  // *optional* callback on success - read more below
        fail:        onAuthorizeFail     // *optional* callback on fail/error - read more below
    }));

    function onAuthorizeSuccess(data, accept){
        console.log('successful connection to socket.io');

        // The accept-callback still allows us to decide whether to
        // accept the connection or not.
        accept(null, true);

        // OR

        // If you use socket.io@1.X the callback looks different
        accept();
    }

    function onAuthorizeFail(data, message, error, accept){
        if(error)
            throw new Error(message);
        console.log('failed connection to socket.io:', message);

        // We use this callback to log all of our failed connections.
        accept(null, false);

        // OR

        // If you use socket.io@1.X the callback looks different
        // If you don't want to accept the connection
        if(error)
            accept(new Error(message));
        // this error will be sent to the user as a special error-package
        // see: http://socket.io/docs/client-api/#socket > error-object
    }

    io.on('connection', function (socket) {
        logger.info('socket.io connection from %s', socket.conn.remoteAddress);
        for (var i = 0, len = controllers.length; i < len; i++) {
            controllers[i](socket);
        }
    });
};