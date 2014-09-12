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

    // Get our session settings from express to use in socket.io connections, which are
    // not going through the same pipeline
    var session = require('./krakenMongoSession');
    io.use(passportSocketIo.authorize({
        cookieParser: require('cookie-parser'),
        key:         'connect.sid',       // the name of the cookie where express/connect stores its session_id
        secret:      session.settings.secret,    // the session_secret to parse the cookie
        store:       session.store,        // we NEED to use a sessionstore. no memorystore please
        success:     onAuthorizeSuccess,
        fail:        onAuthorizeFail
    }));

    function onAuthorizeSuccess(data, accept){
        logger.debug('successful connection to socket.io (%s)', data.user._id);
        accept();
    }

    function onAuthorizeFail(data, message, error, accept){
        if(error) {
            throw new Error(message);
        }
        logger.debug('failed connection to socket.io: %s', message);

        if(error) {
            accept(new Error(message));
        }
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