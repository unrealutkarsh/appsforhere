'use strict';

var log = require('pine')();
var PayPalUser = require('../models/payPalUser');
var PayPalDelegatedUser = require('../models/payPalDelegatedUser');
var appUtils = require('appUtils');

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .all(appUtils.auth)
        .get(function (req, res) {
            res.render('sell/sell');
        })
        .post(function (req, res) {
            var paymentRequest = req.body.payload;
            cleanInvoice(paymentRequest.invoice);
            // TODO probably fill out more stuff on the invoice.
            // or put that on the client.
            paymentRequest.invoice.merchantEmail = req.user.email;
            var url = req.hereApiUrl('pay');
            req.hereApi().post({
                url: url,
                json: true,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                payload: JSON.stringify(paymentRequest),
                tokens: req.user
            }, req.$eat(function (payResult) {
                console.log(payResult);
                if (payResult.errorCode) {
                    payResult.ok = false;
                    res.status(500).json(payResult);
                } else {
                    payResult.ok = true;
                    res.json(payResult);
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
