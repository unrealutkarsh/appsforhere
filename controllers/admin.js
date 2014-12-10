'use strict';
var appUtils = require('../lib/appUtils');

module.exports = function (router) {

    router.use(appUtils.domain);

    router.use(function (req, res, next) {
        if (!req.user || !req.user.groups || req.user.groups.indexOf('admin') < 0) {
            res.render('errors/401');
            return;
        }
        next();
    });

    /**
     * Simple render for the admin base page
     */
    router.get('/', appUtils.auth, appUtils.render('admin/index'));
    /**
     * Simple render for the log viewer page
     */
    router.get('/logs', appUtils.auth, appUtils.render('admin/logs'));

};
