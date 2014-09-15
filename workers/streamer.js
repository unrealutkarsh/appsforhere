'use strict';

var mongo = require('../lib/mongo'),
    Log = require('../models/log'),
    path = require('path'),
    confit = require('confit'),
    mubsub = require('mubsub'),
    logger = require('pine')(),
    io = require('socket.io')(8003);

var logDate = new Date();

/**
 * The streamer is in charge of pushing external events into socket.io "just once" so that you can have multiple
 * consumers (i.e. clustered web/socket servers)
 *
 * Currently, this is just pushing logs into the log room.
 */
var basedir = path.join(__dirname, '../config');

confit(basedir).create(function (err, config) {
    var mubsub = new require('mubsub')(config.get('mongoUrl'),{
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
    mongo.config(config.get('mongoUrl'));
    mongo.connection.once('connected', function () {
        setupLogStreaming();
    });
});


function setupLogStreaming() {
    var lastMsg;
    logger.debug('Setting up tail cursor on mongo log collection');
    Log.where('timestamp').gte(logDate).tailable({ awaitdata: true }).stream()
        .on('data',function (log) {
            if (log.timestamp.getTime() > logDate.getTime()) {
                logDate = log.timestamp;
            }
            if (lastMsg == String(log._id)) {
                // I have no idea why this happens, but it does.
                logger.warn('Duplicate document detected.');
                return;
            }
            lastMsg = String(log._id);
            try {
                io.in('logwatchers').emit('log', JSON.parse(JSON.stringify(log)));
            } catch (x) {
                // If we logged here... that'd be ironic.
                console.log(x);
            }
        }).on('error',function (e) {
            logger.error('log streaming error.', e.message);
        }).on('close', function () {
            logger.error('MongoDB Log cursor closed');
            // Prevent hammering the server
            setTimeout(function () {
                setupLogStreaming();
            }, 2000);
        });
}