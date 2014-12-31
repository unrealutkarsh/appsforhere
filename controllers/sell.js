'use strict';

var log = require('pine')();
var PayPalUser = require('../models/auth/payPalUser');
var PayPalDelegatedUser = require('../models/auth/payPalDelegatedUser');
var SavedOrder = require('../models/savedOrder');
var appUtils = require('../lib/appUtils');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .all(appUtils.auth)
        .get(function (req, res) {
            res.render('sell/sell', req.query);
        })
        .post(function (req, res) {
            var paymentRequest = req.body.payload;
            cleanInvoice(paymentRequest.invoice);
            // TODO probably fill out more stuff on the invoice.
            // or put that on the client.
            paymentRequest.invoice.merchantEmail = req.user.entity.email;
            var url = req.hereApiUrl('pay');
            req.hereApi().post({
                url: url,
                json: true,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                payload: JSON.stringify(paymentRequest),
                tokens: req.user.tokens()
            }, req.$eat(function (payResult) {
                if (payResult.errorCode) {
                    payResult.ok = false;
                    res.status(500).json(payResult);
                } else {
                    SavedOrder.remove({
                        profileId: req.user.entity.profileId,
                        invoiceId: payResult.invoiceID || paymentRequest.invoice.invoiceID
                    }, function () {
                        payResult.ok = true;
                        res.json(payResult);
                    });
                }
            }));
        });

    router.route('/:handle/finalize')
        .all(appUtils.auth)
        .post(function (req, res) {
            var url = req.hereApiUrl('payment/' + req.params.handle);
            req.hereApi().put({
                url: url,
                json: true,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                payload: JSON.stringify(req.body.payload),
                tokens: req.user.tokens()
            }, req.$eat(function (payResult) {
                if (payResult.errorCode) {
                    payResult.ok = false;
                    res.status(500).json(payResult);
                } else {
                    payResult.ok = true;
                    res.json(payResult);
                }
            }));
        });

    router.route('/receipt')
        .all(appUtils.auth)
        .post(function (req, res) {
            var url = req.hereApiUrl('pay/sendReceipt');
            var data = {
                invoiceId: req.body.invoiceId,
                phoneNumber: req.body.phoneNumber,
                email: req.body.email
            };
            req.hereApi().post({
                url: url,
                json: true,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                payload: JSON.stringify(data),
                tokens: req.user.tokens()
            }, req.$eat(function (result) {
                console.log(result);
                if (result.errorCode) {
                    result.ok = false;
                    res.status(500).json(result);
                } else {
                    result.ok = true;
                    res.json(result);
                }
            }));
        });

    router.route('/load/:invoiceId')
        .all(appUtils.auth)
        .get(function (req, res) {
            var url = req.hereApiUrl('invoices/' + req.params.invoiceId);
            console.log(req.params.invoiceId);
            req.hereApi().get({
                url: url,
                json: true,
                tokens: req.user.tokens()
            }, req.$eat(function (invoice) {
                console.log(invoice);
                res.json(invoice);
            }));
        });

    router.route('/preferences')
        .all(appUtils.auth)
        .get(function (req, res) {
            var url = req.hereApiUrl('profile/preferences');
            req.hereApi().get({
                url: url,
                json: true,
                tokens: req.user.tokens()
            }, req.$eat(function (prefs) {
                // Remove item preferences and tax rates since those come back in the product catalog.
                // (just to reduce payload for large product catalogs)
                if (prefs.preferences) {
                    Object.keys(prefs.preferences).forEach(function (k) {
                        if (k.indexOf('SellableItem') === 0 || k.indexOf('TaxRate_') === 0) {
                            delete prefs.preferences[k];
                        }
                    });
                }
                res.json(prefs);
            }));
        });

    router.route('/saved/:locationId')
        .all(appUtils.auth)
        .get(function (req, res) {
            SavedOrder.find({
                locationId: req.params.locationId,
                profileId: req.user.entity.profileId
            }, req.$eat(function (docs) {
                var ret = [];
                if (docs) {
                    docs.forEach(function (d) {
                        ret.push({
                            name: d.name,
                            invoiceId: d.invoiceId
                        });
                    });
                    res.json({orders: ret});
                }
            }));
        })
        .post(function (req, res) {
            var url, method = 'post';
            if (req.body.invoice.invoiceID) {
                url = req.hereApiUrl('invoices/' + req.body.invoice.invoiceID);
                method = 'put';
            } else {
                url = req.hereApiUrl('invoices');
            }
            cleanInvoice(req.body.invoice);
            // TODO probably fill out more stuff on the invoice.
            // or put that on the client.
            req.body.invoice.merchantEmail = req.user.entity.email;
            req.hereApi()[method]({
                url: url,
                json: true,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                payload: JSON.stringify(req.body.invoice),
                tokens: req.user.tokens()
            }, req.$eat(function (payResult) {
                if (payResult.errorCode) {
                    log.error('Failed to save invoice/order: %s', payResult);
                    payResult.ok = false;
                    res.status(500).json(payResult);
                } else {
                    payResult.ok = true;
                    SavedOrder.findOrCreate({
                        profileId: req.user.entity.profileId,
                        invoiceId: payResult.invoiceID,
                        locationId: req.params.locationId,
                        name: req.body.name
                    }, req.$eat(function (doc) {
                        res.json(payResult);
                    }));
                }
            }));

        });

};

function cleanInvoice(inv) {
    for (var i = 0; i < inv.items.length; i++) {
        var item = inv.items[i];
        delete item.itemId;
        delete item.detailId;
    }
}
