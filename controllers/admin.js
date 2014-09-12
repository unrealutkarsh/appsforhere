'use strict';
var appUtils = require('appUtils');

module.exports = function (router) {

    router.use(appUtils.domain);

    router.get('/', appUtils.auth, function (req, res) {
        if (!req.user.groups || req.user.groups.indexOf('admin') < 0) {
            res.render('errors/401');
            return;
        }
        res.render('admin/index');
    });

    router.get('/logs', appUtils.auth, function (req, res) {
        if (!req.user.groups || req.user.groups.indexOf('admin') < 0) {
            res.render('errors/401');
            return;
        }
        res.render('admin/logs');
    });

};
