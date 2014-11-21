'use strict';

var logger = require('pine')();
var appUtils = require('appUtils');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .get(function (req, res) {
            res.json({
                ok: true
            });
        });
};
