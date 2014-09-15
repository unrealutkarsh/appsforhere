'use strict';
var logger = require('pine')();
/* NewRelic is disabled until this is fixed: https://github.com/krakenjs/kraken-js/issues/285
 if (process.env.NODE_ENV === 'production') {
 logger.info("Starting newrelic agent.");
 require('newrelic');
 } else {
 logger.info("newrelic inactive (%s).", process.env.NODE_ENV || 'no NODE_ENV set');
 }
 */

var mongo = require('./lib/mongo'),
    kraken = require('kraken-js'),
    express = require('express'),
    app = require('express')(),
// These two lines are required to get Socket.io to work properly
    server = require('http').Server(app),
    io = require('socket.io')(server),
    passport = require('passport'),
    PayPalStrategy = require('./lib/payPalStrategy'),
    PayPalUser = require('./models/payPalUser'),
    PayPalDelegatedUser = require('./models/payPalDelegatedUser'),
    Queue = require('./lib/queue'),
    Liwp = require('node-liwp'),
    options = {
        onconfig: function appsforhereConfiguration(config, next) {
            configureLogging(config);
            configureMongo(config);
            configurePassport(config);
            configureQueue();

            next(null, config);
        }
    },
    port = process.env.PORT || 8000,
    mongoReady = false;

/**
 * Setup Pasport authentication right after the core session store is setup
 */
app.on('middleware:after:session', function addPassportToSession(eventargs) {
    app.use(passport.initialize());
    app.use(passport.session());
});

app.use(kraken(options));

/**
 * Don't listen until the initial mongo connection is ready
 */
if (mongoReady) {
    listen();
}

function listen() {
    // The kraken generator uses app.listen, but we need server.listen to make socket.io work
    server.listen(port, function (err) {
        logger.info('[%s] Listening on http://localhost:%d', app.settings.env, port);
    });
}

/**
 * Gracefully shutdown when pm2 shuts down by closing the server. Since we'll take less time
 * than socket.io shutdown, they're in charge of process.exit(0)
 */
process.on('message', function (msg) {
    if (msg == 'shutdown') {
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
function configureQueue() {
    var queueOptions = {
        process: true
    };
    if (process.env.NO_QUEUE_PROCESSING) {
        queueOptions.process = false;
    }
    Queue.init(mongo.db, queueOptions);
}

/**
 * Setup winston to use MongoDB
 * @param config from Kraken/confit
 */
function configureLogging(config) {
    var MongoDB = require('winston-mongodb').MongoDB;
    // only way to set the default logger config is via the private pine impl
    logger._impl.add(MongoDB, config.get('winston-mongodb'));
}

/**
 * Set the mongodb/mongoose connection and use it for the socket.io server
 * once it's connected
 * @param config from Kraken/confit
 */
function configureMongo(config) {
    mongo.config(config.get('mongoUrl'));
    mongo.connection.once('connected', function () {
        // This infra needs a mongo connection for session data, so wait...
        var mubsub = require('mubsub')(config.get('mongoUrl'), {
            auto_reconnect: true
        });
        io.adapter(require('socket.io-adapter-mongo')({
            client: mubsub
        }));
        // There's a problem with socket.io-adapter-mongo in that it doesn't catch channel errors
        // and that brings down the server. They can happen in 'normal operation' for temporary network issues
        mubsub.channels['socket.io'].on('error', function (e) {
            logger.warn('Mubsub error: %s\n%s', e.message, e.stack);
        });
        require('./lib/controllers.io')(io);
        if (!mongoReady) {
            mongoReady = true;
            listen();
        }
    });
}

/**
 * Configure the passport strategies for live and for sandbox
 * @param config from Kraken/confit
 */
function configurePassport(config) {
    passport.use(new PayPalStrategy({
            clientID: process.env.PAYPAL_APP_ID,
            clientSecret: process.env.PAYPAL_APP_SECRET,
            callbackURL: process.env.PAYPAL_RETURN_URL || 'https://appsforhereweb.ebaystratus.com/oauth/return',
            passReqToCallback: true
        },
        function savePassportUserToMongo(req, accessToken, refreshToken, profile, done) {
            PayPalUser.encryptRefreshToken(refreshToken, req.res, function (error, enc_token) {
                if (error) {
                    done(error);
                    return;
                }
                PayPalUser.findOrCreate({ profileId: profile.id },
                    {
                        access_token: accessToken,
                        encrypted_refresh_token: enc_token,
                        email: profile.emails[0].value,
                        currency: profile.currency,
                        country: profile.country
                    },
                    { upsert: true },
                    function (err, user) {
                        return done(err, user);
                    });
            });
        }
    ));

    passport.use(new PayPalStrategy({
            name: 'sandbox',
            callbackURL: process.env.PAYPAL_RETURN_URL || 'https://appsforhereweb.ebaystratus.com/oauth/return',
            clientID: 'AeoOpBB2XJWwORPT8Q7NpPQgr8eStz39tt8IsM6wRaxiRg50hdMTSgNk7rFg',
            clientSecret: 'EDZTDBAH7SoQsPZxVAJ4n7SvVfMwWGziwLpJsvKj8Ghe8Wxm1Hg70Tt2pXP7',
            authorizationURL: 'https://www.sandbox.paypal.com/webapps/auth/protocol/openidconnect/v1/authorize',
            tokenURL: 'https://api.sandbox.paypal.com/v1/identity/openidconnect/tokenservice',
            profileURL: 'https://api.sandbox.paypal.com/v1/identity/openidconnect/userinfo/?schema=openid',
            statusURL: 'https://api.sandbox.paypal.com/retail/merchant/v1/status',
            hereApi: new Liwp({
                appId: 'AeoOpBB2XJWwORPT8Q7NpPQgr8eStz39tt8IsM6wRaxiRg50hdMTSgNk7rFg',
                secret: 'EDZTDBAH7SoQsPZxVAJ4n7SvVfMwWGziwLpJsvKj8Ghe8Wxm1Hg70Tt2pXP7'
            }),
            passReqToCallback: true
        },
        function saveSandboxPassportUserToMongo(req, accessToken, refreshToken, profile, done) {
            PayPalUser.encryptRefreshToken(refreshToken, req.res, function (error, enc_token) {
                if (error) {
                    done(error);
                    return;
                }
                PayPalUser.findOrCreate({ profileId: 'sandbox-' + profile.id },
                    {
                        access_token: accessToken,
                        encrypted_refresh_token: enc_token,
                        email: profile.emails[0].value,
                        currency: profile.currency,
                        country: profile.country,
                        environment: 'sandbox'
                    },
                    { upsert: true },
                    function (err, user) {
                        return done(err, user);
                    });
            });
        }));

    passport.serializeUser(function serializePassportUser(user, done) {
        if (user._isDelegatedUser) {
            done(null, 'delegated_' + user.id);
        } else {
            done(null, user.id);
        }
    });

    passport.deserializeUser(function deserializePassportUser(id, done) {
        if (id.indexOf('delegated_') == 0) {
            PayPalDelegatedUser.findOne({_id: id.substring('delegated_'.length)}, function (err, user) {
                done(null, user);
            });
        } else {
            PayPalUser.findOne({_id: id}, function (err, user) {
                done(null, user);
            });
        }
    });
}