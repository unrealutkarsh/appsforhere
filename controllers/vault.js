'use strict';

var logger = require('pine')();
var passport = require('passport');
var PayPalUser = require('../models/payPalUser');
var PayPalDelegatedUser = require('../models/payPalDelegatedUser');
var appUtils = require('appUtils');
var crypto = require('crypto');
var util = require('util');
var Vault = require('../models/vault');

// Create a token generator with the default settings:
var randtoken = require('rand-token').generator({
    chars: 'abcdefghijklmnpqrstuvwxyz0123456789'
});

module.exports = function (router) {

    router
        .use(appUtils.domain);

    router.route('/')
        .all(appUtils.auth)
        .get(function (req, res) {
            res.render('vault/index', {
                host: req.headers.host,
                hash: codeForId(req.user.profileId),
                code: 'CODE_HERE'
            });
        });

    router.get('/pickup/:verification/:code', function (req, res, next) {
        Vault.findOne({short_code: req.params.code}, function (e, d) {
            if (e) {
                next(e);
            } else if (!d) {
                res.status(404).json({
                    error: 'Code not found'
                });
            } else {
                var v = codeForId(d.profileId);
                if (v === req.params.verification) {
                    res.json({
                        card_id: d.card_id,
                        valid_until: d.valid_until,
                        number: d.number
                    });
                    if (req.query.delete === 'true') {
                        d.remove();
                    }
                } else {
                    res.status(404).json({
                        error: 'Code not found.'
                    });
                }
            }
        });
    });

    router.route('/save')
        .all(appUtils.auth)
        .post(function (req, res, next) {
            var url = req.hereApiUrl('credit-card', 'vault');
            var dateParts = req.body['card-expiration'].split('/');
            var y = parseInt(dateParts[1]);
            if (y < 2000) {
                y += 2000;
            }
            var body = {
                number: req.body['card-number'].replace(/[^0-9]/g, ''),
                type: req.body['card-type'],
                expire_month: String(parseInt(dateParts[0])),
                expire_year: String(y),
                cvv2: req.body['card-cvc']
            };
            req.hereApi().post({
                url: url,
                tokens: req.user,
                json: true,
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body)
            }, function (err, rz) {
                if (err) {
                    next(err);
                    return;
                }
                if (rz.debug_id) {
                    next(new Error('Card failed: ' + util.inspect(rz)));
                    return;
                }
                saveCode(req, rz, function (err, doc) {
                    res.render('vault/index', {
                        host: req.headers.host,
                        hash: codeForId(req.user.profileId),
                        code: doc.short_code,
                        number: endOf(doc.number, 4)
                    });
                });
            });
        });

    function saveCode(req, cardInfo, cb) {
        var short = randtoken.generate(5);
        var doc = new Vault({
            card_id: cardInfo.id,
            short_code: short,
            profileId: req.user.profileId,
            timestamp: new Date(),
            valid_until: cardInfo.valid_until,
            number: cardInfo.number
        });
        doc.save(function (err) {
            if (err && err.code === 11000 &&
                err.err && err.err.indexOf('duplicate') >= 0) {
                if (cardInfo.tries > 20) {
                    cb(err);
                } else {
                    if (cardInfo.tries) {
                        cardInfo.tries++;
                    } else {
                        cardInfo.tries = 1;
                    }
                    saveCode(req, cardInfo, cb);
                }
            } else if (err) {
                cb(err);
            } else {
                cb(null, doc);
            }
        });
    }

    function endOf(str, chars) {
        str = str.replace(new RegExp('[=]+$'), '');
        if (str.length < chars) {
            return str;
        }
        return str.substr(str.length - chars + 1);
    }

    function codeForId(profileId) {
        var shasum = crypto.createHash('sha1');
        shasum.update(profileId);
        shasum.update('saltoftheearth');
        return endOf(shasum.digest('base64'), 8);
    }
};