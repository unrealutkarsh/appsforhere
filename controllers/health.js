'use strict';

var logger = require('pine')();
var os = require('os');
var appUtils = require('../lib/appUtils');

module.exports = function (router) {

    var host = os.hostname();

    router
        .use(appUtils.domain);

    router.route('/')
        .get(function (req, res) {
            res.json({
                ok: true,
                host: host,
                uptime: os.uptime(),
                freemem: parseInt(os.freemem()*100/os.totalmem()),
                load: os.loadavg()
            });
        });
};
