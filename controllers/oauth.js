'use strict';

var logger = require('pine')();
var passport = require('passport');
var PayPalUser = require('../models/payPalUser');
var PayPalDelegatedUser = require('../models/payPalDelegatedUser');
var appUtils = require('../lib/appUtils');

var appScopes = 'openid https://uri.paypal.com/services/paypalhere email https://uri.paypal.com/services/paypalattributes profile https://api.paypal.com/v1/vault/credit-card https://api.paypal.com/v1/vault/credit-card/.*';
var sandboxScopes = 'openid https://uri.paypal.com/services/paypalhere email https://uri.paypal.com/services/paypalattributes profile';

module.exports = function (router) {

    router.use(appUtils.domain);

    router.get('/profileId', function (req, res, next) {
       if (!req.user || !req.user.profileId) {
           res.status(401).json({logged_in:false});
       } else {
           res.json({
               logged_in:true,
               profileId:req.user.profileId,
               email:req.user.email,
               _csrf:res.locals._csrf
           });
       }
    });

    router.get('/login', function (req, res, next) {
        if (req.query.returnUrl) {
            logger.info('Login setting returnUrl to %s', req.query.returnUrl);
            req.session.redirectUrl = req.query.returnUrl;
        }
        req.session.environment = 'live';
        passport.authenticate('paypal', {
            scope: appScopes
        })(req, res, next);
    });

    router.get('/login-sandbox', function (req, res, next) {
        req.session.environment = 'sandbox';
        passport.authenticate('sandbox', {
            scope: sandboxScopes
        })(req, res, next);
    });

    router.get('/return',
        function (req, res, next) {
            if (req.session.environment === 'sandbox') {
                logger.verbose('Using sandbox login.');
                passport.authenticate('sandbox', { failureRedirect: '/oauth/fail' })(req, res, next);
            } else {
                passport.authenticate('paypal', { failureRedirect: '/oauth/fail' })(req, res, next);
            }
        },
        function (req, res) {
            if (req.session.redirectUrl) {
                var url = req.session.redirectUrl;
                delete req.session.redirectUrl;
                res.redirect(url);
            } else {
                res.redirect('/');
            }
        });

    router.get('/logout', function (req, res) {
        delete req.session.redirectUrl;
        req.session.destroy();
        req.logout();
        res.redirect('/');
    });

    router.route('/delegates')
        .all(appUtils.apiAuth)
        .all(appUtils.hasRoles('NoDelegatesCanUseThis'))
        .get(function (req, res) {
            PayPalDelegatedUser.find({profileId: req.user.profileId}, req.$eat(function mongoDelegateResult(docs) {
                var ret = {delegates: []};
                docs.forEach(function delegateTranslation(d) {
                    ret.delegates.push({
                        id: d.id,
                        name: d.name,
                        allowed: d.allowedResources,
                        lastLogin: d.lastLogin,
                        created: d.createDate
                    });
                });
                res.json(ret);
            }));
        })
        .post(function (req, res, next) {
            PayPalUser.decryptRefreshToken(req, function (decryptError, raw_token) {
                if (decryptError) {
                    req.logout();
                    next(decryptError);
                } else {
                    PayPalDelegatedUser.encryptRefreshToken(raw_token, req.body.password, req.$eat(function (tokenInfo) {
                        var delegate = new PayPalDelegatedUser({
                            name: req.body.name,
                            profileId: req.user.profileId,
                            access_token: req.user.access_token,
                            email: req.user.email,
                            encrypted_refresh_token: tokenInfo.token,
                            createDate: new Date(),
                            allowedResources: req.body.allowed
                        });
                        delegate.save(req.$eat(function (doc) {
                            res.json({
                                success: true,
                                url: 'https://' + req.headers.host + '/oauth/delegates/' + doc.id + '/' + tokenInfo.key
                            });
                        }));
                    }));
                }
            });
        });

    router.route('/delegates/:id')
        .all(appUtils.apiAuth)
        .all(appUtils.hasRoles('NoDelegatesCanUseThis'))
        .get(function (req, res) {
            PayPalDelegatedUser.findOneAndRemove({_id: req.params.id, profileId: req.user.profileId}, req.$eat(function (doc) {
                if (doc) {
                    res.json({success: true});
                } else {
                    res.json({success: false, message: 'No record found.'});
                }
            }));
        });

    function failDelegateLogin(req, res) {
        res.render('settings/delegateLogin', {
            id: req.params.id,
            uuid: req.params.uuid,
            showError: true
        });
    }

    router.route('/delegates/:id/:uuid')
        .get(function (req, res) {
            req.logout();
            res.render('settings/delegateLogin', {
                id: req.params.id,
                uuid: req.params.uuid
            });
        })
        .post(function (req, res, next) {
            PayPalDelegatedUser.findById(req.params.id, req.$eat(function (user) {
                if (!user) {
                    logger.error('Delegate login attempted for unknown delegate %s', req.params.id);
                    failDelegateLogin(req, res);
                    return;
                }
                user.decryptRefreshToken(req.params.uuid, req.body.password, function (err, rt, binKey) {
                    if (err) {
                        failDelegateLogin(req, res);
                        return;
                    }
                    res.cookie('sessionkey', binKey.toString('base64'));
                    user._isDelegatedUser = true;
                    req.login(user, function (err) {
                        if (err) {
                            next(err);
                        } else {
                            res.redirect('/');
                        }
                    });
                });
            }));
        });
};
