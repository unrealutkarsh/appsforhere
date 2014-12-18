/*───────────────────────────────────────────────────────────────────────────*\
 │  Copyright (C) 2014 eBay Software Foundation                               │
 |                                                                            |
 | yyyyyyyyyyyysssssssssss+++osssssssssssyyyyyyyyyyyy                         |
 | yyyyyysssssssssssssss/----../sssssssssssssssyyyyyy                         |
 | sysssssssssssssssss/--:-`    `/sssssssssssssssssys                         |
 | sssssssssssssssso/--:-`        `/sssssssssssssssss   AppsForHere           |
 | sssssssssssssso/--:-`            `/sssssssssssssss                         |
 | sssssssssssso/-::-`                `/sssssssssssss   Advanced integration  |
 | sssssssssso/-::-`                    `/sssssssssss   for PayPal Here and   |
 | sssssssso/-::-`                        `/sssssssss   the PayPal retail     |
 | ssssoso:-::-`                            `/osossss   family of products.   |
 | osooos:-::-                                -soooso                         |
 | ooooooo:---.``````````````````````````````.+oooooo                         |
 | oooooooooooooooooooooooooooooooooooooooooooooooooo                         |
 \*───────────────────────────────────────────────────────────────────────────*/
'use strict';
var logger = require('pine')();

if (process.env.NODE_ENV === 'production') {
    logger.info("Starting newrelic agent.");
    // Temporarily required to fix newrelic's invasive methods.
    require('newrelicbuster');
    require('newrelic');
} else {
    logger.info("newrelic inactive (%s).", process.env.NODE_ENV || 'no NODE_ENV set');
}

var mongo = require('./lib/mongo'),
    kraken = require('kraken-js'),
    express = require('express'),
    app = require('express')(),
    passport = require('passport'),
    expressWinston = require('express-winston'),
    configurePassport = require('./lib/passportSetup'),
    PayPalUser = require('./models/auth/payPalUser'),
    PayPalDelegatedUser = require('./models/auth/payPalDelegatedUser'),
    Queue = require('./lib/queue'),
    appUtils = require('./lib/appUtils'),
    options = {
        onconfig: function appsforhereConfiguration(config, next) {
            if (GLOBAL._hasShutdown) {
                return;
            }
            require('./lib/dust-helpers');
            configureLogging(config);
            configureMongo(config);
            appUtils.configure(config);
            configurePassport(config);
            configureQueue(config);

            next(null, config);
        }
    },
    port = process.env.PORT || 8000,
    mongoReady = false;

// Created when we're the master in the listen function.
var server;

/**
 * Setup Pasport authentication right after the core session store is setup
 */
app.on('middleware:after:session', function addPassportToSession(eventargs) {
    app.use(passport.initialize());
    app.use(passport.session());
    // Put some common things for all dust templates to use
    app.use(function (req, res, next) {
        res.locals.userEmail = req.user ? req.user.entity.email : null;
        res.locals.userCurrency = req.user ? req.user.entity.currency : null;
        res.locals.userEnvironment = req.user ? req.user.entity.environment : null;
        next();
    });
});

app.on('middleware:after:router', function addExpressWinston(eventargs) {
    app.use(expressWinston.errorLogger({
        winstonInstance: logger._impl
    }));
});

expressWinston.requestWhitelist = ['url', 'headers', 'method', 'httpVersion', 'originalUrl', 'query'];
expressWinston.bodyWhitelist = ['none'];

// express-winston logger makes sense BEFORE the router.
var ewLogger = expressWinston.logger({
    winstonInstance: logger._impl,
    msg: "{{req.method}} {{req.logSafeUrl}} {{res.statusCode}} {{res.responseTime}}ms",
    meta: false
});
app.use(function (req, res, next) {
    var badParams = /uuid=(.+[^0-9\-])/g;
    req.logSafeUrl = req.url.replace(badParams, 'uuid=*');
    return ewLogger(req, res, next);
});

app.use(kraken(options));

// The kraken generator uses app.listen, but we need to get lower make socket.io work (with sticky cluster routing)
function listen(config) {
    var sticky = require('sticky-session');

    function clusterStart() {
        server = require('http').Server(app);
        var io = require('socket.io')(server);

        var mubsub = require('mubsub')(config.get('mongoUrl'), {
            auto_reconnect: true
        });
        // Create the mubsub channel for socket.io with the configured settings
        mubsub.channel('socket.io', config.get('socket.io').mubsub);
        io.adapter(require('socket.io-adapter-mongo')({
            client: mubsub
        }));
        // There's a problem with socket.io-adapter-mongo in that it doesn't catch channel errors
        // and that brings down the server. They can happen in 'normal operation' for temporary network issues
        mubsub.channels['socket.io'].on('error', function (e) {
            logger.warn('Mubsub error: %s\n%s', e.message, e.stack);
        });
        require('./lib/controllers.io')(io);

        return server;
    }

    var stickyServer, workerCount;
    if (config.get('cluster') && (workerCount = config.get('cluster').workers)) {
        logger.info('Using %d cluster workers', workerCount);
    } else {
        workerCount = Math.min(6, require('os').cpus().length);
        logger.info('Defaulting to %d cluster workers (%d cpus)', workerCount, require('os').cpus().length);
    }
    if (workerCount > 1) {
        stickyServer = sticky(workerCount, clusterStart);
        stickyServer.listen(port, function (err) {
            logger.info('[%s] Sticky server listening on http://localhost:%d', app.settings.env, port);
        });
    } else {
        clusterStart();
        server.listen(port, function (err) {
            logger.info('[%s] Standard server listening on http://localhost:%d', app.settings.env, port);
        });
    }
}

/**
 * Gracefully shutdown when pm2 shuts down by closing the server. Since we'll take less time
 * than socket.io shutdown, they're in charge of process.exit(0)
 */
process.on('message', function (msg) {
    if (msg == 'shutdown') {
        GLOBAL._hasShutdown = true;
        console.log('Shutting down kraken');
        try {
            server.close();
        } catch (x) {
            console.log('Kraken shutdown failed', x.message);
        }
    }
});

/**
 * The queue monitor will look for delayed jobs and execute them
 */
function configureQueue(config) {
    var queueOptions = {
        process: true
    };
    if (process.env.NO_QUEUE_PROCESSING) {
        queueOptions.process = false;
    }
    Queue.init(mongo.db, config, queueOptions);
}

/**
 * Setup winston to use MongoDB
 * @param config from Kraken/confit
 */
function configureLogging(config) {
    // Make sure the collection is created before we start logging.
    var Log = require('./models/log');
    new Log({message:'Ensuring capped collection.'}).save(function () {
        var MongoDB = require('winston-mongodb').MongoDB;
        // only way to set the default logger config is via the private pine impl
        logger._impl.add(MongoDB, config.get('winston-mongodb'));
    });
}

/**
 * Set the mongodb/mongoose connection and use it for the socket.io server
 * once it's connected
 * @param config from Kraken/confit
 */
function configureMongo(config) {
    mongo.config(config.get('mongoUrl'));
    mongo.connection.once('connected', function () {
        if (GLOBAL._hasShutdown) {
            return;
        }
        // This infra needs a mongo connection for session data, so we don't listen until it's up...
        if (!mongoReady) {
            mongoReady = true;
            listen(config);
        }
    });
}
