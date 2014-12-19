'use strict';

var logger = require('pine')();
var passport = require('passport');
var Token = require('../models/auth/token');
var PayPalUser = require('../models/auth/payPalUser');
var PayPalDelegatedUser = require('../models/auth/payPalDelegatedUser');
var appUtils = require('../lib/appUtils');
var userDeserialize = require('../lib/passportSetup').deserialize;

var appScopes = 'openid https://uri.paypal.com/services/paypalhere email https://uri.paypal.com/services/paypalattributes profile https://api.paypal.com/v1/vault/credit-card https://api.paypal.com/v1/vault/credit-card/.*';
var sandboxScopes = 'openid https://uri.paypal.com/services/paypalhere email https://uri.paypal.com/services/paypalattributes profile';

module.exports = function (router) {

    router.use(appUtils.domain);

    function sendVerifyResponse(user, res) {
        res.json({
            logged_in: true,
            profileId: user.entity.profileId,
            email: user.entity.email,
            currency: user.entity.currency,
            country: user.entity.country,
            _csrf: res.locals._csrf,
            ticket: user.id
        });
    }

    /**
     * The verify endpoint allows an application in possession of a user ticket (either in session
     * object or passed explicity via the ticket parameter) and appropriate cookies to verify
     * basic session validity as well as common user info like email and currency.
     */
    router.get('/verify', function (req, res, next) {
        if (!req.user || !req.user.entity.profileId) {
            // Check to see if we've got a payload for login
            if (req.query.ticket) {
                // Try to log them in.
                userDeserialize(req.query.ticket, function (err, user) {
                    if (user) {
                        req.login({account:user.account,delegate:user.delegate,token:user.token}, function (e) {
                            if (e) {
                                return res.status(401).json({logged_in: false});
                            }
                            sendVerifyResponse(user, res);
                        });
                    } else {
                        res.status(401).json({logged_in: false});
                    }
                });
            } else {
                res.status(401).json({logged_in: false});
            }
        } else {
            sendVerifyResponse(req.user, res);
        }
    });

    /**
     * Send the user off to PayPal to login.
     */
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

    /**
     * Send the user off to PayPal Sandbox to login
     */
    router.get('/login-sandbox', function (req, res, next) {
        req.session.environment = 'sandbox';
        passport.authenticate('sandbox', {
            scope: sandboxScopes
        })(req, res, next);
    });

    /**
     * After login is complete on PayPal, process the various tokens and setup the req.user
     * and session for future authentication
     */
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

    /**
     * Clear session and cookies
     */
    router.get('/logout', function (req, res) {
        delete req.session.redirectUrl;
        req.session.destroy();
        res.cookie('tokenguid', '');
        req.logout();
        res.redirect('/');
    });

    router.route('/delegates')
        .all(appUtils.apiAuth)
        .all(appUtils.hasRoles('NoDelegatesCanUseThis'))
        /**
         * Get a list of the delegates created by the active primary user
        */
        .get(function (req, res) {
            PayPalDelegatedUser.find({profileId: req.user.account.profileId}, req.$eat(function mongoDelegateResult(docs) {
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
        /**
         * Create a new delegate with the token information of the active primary account and the specified privileges
        */
        .post(function (req, res, next) {
            Token.decryptRefreshToken(req, function (decryptError, raw_token) {
                if (decryptError) {
                    req.logout();
                    next(decryptError);
                } else {
                    PayPalDelegatedUser.encryptRefreshToken(raw_token, req.body.password, req.$eat(function (tokenInfo) {
                        var delegate = new PayPalDelegatedUser({
                            name: req.body.name,
                            profileId: req.user.account.profileId,
                            email: req.user.account.email,
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

    /**
     * Delete a delegate. TODO not a GET.
     */
    router.route('/delegates/:id')
        .all(appUtils.apiAuth)
        .all(appUtils.hasRoles('NoDelegatesCanUseThis'))
        .get(function (req, res) {
            PayPalDelegatedUser.findOneAndRemove({_id: req.params.id, profileId: req.user.account.profileId}, req.$eat(function (doc) {
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

    /**
     * Handle delegate login form presentation and processing.
     */
    router.route('/delegates/:id/:uuid')
        .get(function (req, res) {
            req.logout();
            res.render('settings/delegateLogin', {
                id: req.params.id,
                uuid: req.params.uuid
            });
        })
        .post(function (req, res, next) {
            PayPalDelegatedUser.login(req, res, {
                id: req.params.id,
                uuid: req.params.uuid,
                password: req.body.password
            }, function (err) {
                if (err) {
                    next(err);
                } else {
                    res.redirect('/');
                }
            });
        });
};
