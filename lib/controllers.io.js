'use strict';
var logger = require('pine')(),
    domain = require('domain'),
    fs = require('fs'),
    path = require('path'),
    finder = require('findit'),
    passportSocketIo = require('passport.socketio'),
    logger = require('pine')();

module.exports = function (io, sessionStore, cookieParser) {
    var controllers = [], ready = false;
    var controllerEmitter = finder(path.resolve(__dirname,'../controllers.io'));

    controllerEmitter.on('file', function (f) {
        if (path.extname(f).toLowerCase() === '.js') {
            var reqpath = path.relative(__dirname,f);
            logger.debug('Loading socket.io controller at %s', reqpath);
            controllers.push(require(reqpath));
        }
    });

    controllerEmitter.on('end', function () {
        logger.debug('Completed socket.io controller setup (Loaded %d modules).', controllers.length);
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
        if (!ready) {
            logger.error('Socket connected before server is ready.');
            throw new Error('Server starting up.');
        }
        accept();
    }

    function onAuthorizeFail(data, message, error, accept){
        if(error) {
            logger.error(message);
            throw new Error(message);
        }
        logger.debug('failed connection: %s', message);

        if(error) {
            accept(new Error(message));
        }
        // this error will be sent to the user as a special error-package
        // see: http://socket.io/docs/client-api/#socket > error-object
    }

    io.on('connection', function (socket) {
        logger.info('socket.io connection from %s (%s)', socket.conn.remoteAddress, socket.request.user._id.toString());
        var d = domain.create();
        socket.request.activeDomain = d;
        d.on('error', function (err) {
            try {
                // handle the error safely
                logger.error('Uncaught exception! %s\n%s', err.message, err.stack);
            } catch (x) {
            }
            socket.disconnect();
        });
        d.add(socket);
        d.run(function () {
            for (var i = 0, len = controllers.length; i < len; i++) {
                controllers[i](io, socket);
            }
        });
        socket.on('disconnect', function () {
            delete socket.request.activeDomain;
            d.remove(socket);
            d.dispose();
        });
    });
};