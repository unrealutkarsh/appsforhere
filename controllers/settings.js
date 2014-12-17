'use strict';

var logger = require('pine')();
var passport = require('passport');
var PayPalUser = require('../models/auth/payPalUser');
var PayPalDelegatedUser = require('../models/auth/payPalDelegatedUser');
var appUtils = require('../lib/appUtils');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .all(appUtils.auth)
        .get(function (req, res) {
            res.render('settings/settings');
        });
};