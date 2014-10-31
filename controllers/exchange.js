'use strict';

var logger = require('pine')();
var passport = require('passport');
var PayPalUser = require('../models/payPalUser');
var PayPalDelegatedUser = require('../models/payPalDelegatedUser');
var appUtils = require('appUtils');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .get(function (req, res) {
            res.render('exchange/index', {
                host: req.headers.host
            });
        });
};