'use strict';

var logger = require('pine')();
var appUtils = require('appUtils');
var reportLib = require('../lib/reports/payPalSalesReportsApi');
var querystring = require('querystring');
var csv = require('csv');
var async = require('async');
var PayPalDelegatedUser = require('../models/payPalDelegatedUser');
var PayPalUser = require('../models/payPalUser');
var _ = require('underscore');

module.exports = function (router) {
    router.use(appUtils.domain);

    var hasViewReportRole = appUtils.hasRoles(appUtils.ROLES.ViewReports);

    router.get('/', appUtils.auth, hasViewReportRole, function (req, res) {
       res.render('reports/reports');
    });

    router.get('/api', appUtils.auth, hasViewReportRole, function (req, res) {
        var qs = _.clone(req.query);
        delete qs.url;
        reportLib.request(req, 'https://pph-reporting.pphme.ebaystratus.com/' + req.query.url + '?' + querystring.stringify(qs),
            function (rErr, rz) {
                if (rErr) {
                    logger.error('Error getting report: %s\n%s', rErr.message, rErr.stack);
                    res.json({errorCode: 0xdeadbeef, message: rErr.message});
                    return;
                }
                if (req.query.transform && reportLib.transformers[req.query.transform]) {
                    rz = reportLib.transformers[req.query.transform](rz);
                }
                res.json(rz);
            });
    });
};
