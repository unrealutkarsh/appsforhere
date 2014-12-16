'use strict';
var appUtils = require('../lib/appUtils');

module.exports = function (router) {

    router.use(appUtils.domain);

    router.get('/', function (req, res) {
        if (req.isAuthenticated()) {
            // We're going to make PayPal Access calls here,
            // and we didn't use auth because we're
            // sharing this URL with unauthenticated access, so we have
            // to setup the infra first.
            appUtils.payPalAccess(req);
            res.render('index_loggedIn',{});
        } else {
            res.render('index', {});
        }

    });

    router.get('/new', appUtils.auth, function (req, res) {
       res.render('devices/new');
    });

};
