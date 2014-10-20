/*───────────────────────────────────────────────────────────────────────────*\
 │  Copyright (C) 2014 eBay Software Foundation                               │
 |                                                                            |
 | yyyyyyyyyyyysssssssssss+++osssssssssssyyyyyyyyyyyy                         |
 | yyyyyysssssssssssssss/----../sssssssssssssssyyyyyy                         |
 | sysssssssssssssssss/--:-`    `/sssssssssssssssssys                         |
 | sssssssssssssssso/--:-`        `/sssssssssssssssss   AppsForHere           |
 | sssssssssssssso/--:-`            `/sssssssssssssss                         |
 | sssssssssssso/-::-`                `/sssssssssssss   Advanced integration  |
 | sssssssssso/-::-`                    `/sssssssssss   for PayPal Here and   |
 | sssssssso/-::-`                        `/sssssssss   the PayPal retail     |
 | ssssoso:-::-`                            `/osossss   family of products.   |
 | osooos:-::-                                -soooso                         |
 | ooooooo:---.``````````````````````````````.+oooooo                         |
 | oooooooooooooooooooooooooooooooooooooooooooooooooo                         |
 \*───────────────────────────────────────────────────────────────────────────*/
'use strict';

var domain = require('domain');
var logger = require('pine')();
var assert = require('assert');
var PayPalUser = null;
var PayPalDelegatedUser = null;
var Liwp = require('node-liwp');

function saveAccessTokenOnCompletion(req) {
    req.res.on('finish', function () {
        if (req.user) {
            if (req.user instanceof PayPalDelegatedUser) {
                PayPalDelegatedUser.update({_id: req.user._id}, {$set: {access_token: req.user.access_token}}, function () {
                    logger.verbose('Saving updated access token to delegated user.');
                });
            } else {
                PayPalUser.update({_id: req.user._id}, {$set: {access_token: req.user.access_token}}, function () {
                    logger.verbose('Saving updated access token.');
                });
            }
        }
    });
}

function setupForPayPalAccess(req, res, next) {
    // Since we store encrypted refresh tokens, if the LoginWithPayPal
    // infrastructure needs to refresh a token, we need access to the
    // request cookies to decrypt them.
    if (req.user) {
        req.user.refresh_token = function (user, cb) {
            logger.verbose('Refreshing access token.');
            if (!PayPalUser) {
                // This is here to avoid a cyclical require that causes mongoose to get confused
                PayPalUser = require('../models/payPalUser');
                PayPalDelegatedUser = require('../models/payPalDelegatedUser');
            }
            assert(user.profileId === req.user.profileId, 'MISMATCH IN ACTIVE USER AND REFRESH TOKEN USER.');
            if (user instanceof PayPalDelegatedUser) {
                PayPalDelegatedUser.decryptRefreshTokenWithKey(req, function (decryptError, realToken) {
                    if (decryptError) {
                        req.logout();
                        logger.error('Failed to decrypt delegated refresh token %s\n%s', decryptError.message, decryptError.stack);
                        cb(decryptError);
                    } else {
                        req.user._new_refresh_token = realToken;
                        saveAccessTokenOnCompletion(req);
                        cb(null, realToken);
                    }
                });
            } else {
                PayPalUser.decryptRefreshToken(req, function (decryptError, realToken) {
                    if (decryptError) {
                        req.logout();
                        logger.error('Failed to decrypt refresh token %s\n%s', decryptError.message, decryptError.stack);
                        cb(decryptError);
                    } else {
                        saveAccessTokenOnCompletion(req);
                        cb(null, realToken);
                    }
                });
            }
        };
        // To allow better module/lib interop, we move these up to the request, so modules
        // can work even w/o a user (by the controller injecting these into the request)
        req.hereApiUrl = req.user.hereApiUrl;
        req.hereApi = req.user.hereApi;
    }
    if (next) {
        next();
    }
}

function ensureAuth(isInteractive, req, res, next) {
    req._isInteractiveAuth = isInteractive;
    setupForPayPalAccess(req);
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.redirectUrl = req.url;
    if (isInteractive) {
        res.render('index', {showAlert: true});
    } else {
        res.redirect('/oauth/login');
    }
}

function ensureInteractive(req, res, next) {
    ensureAuth(true, req, res, next);
}

function ensureAutomatic(req, res, next) {
    ensureAuth(false, req, res, next);
}

function rolesMatch(roles, allowed) {
    for (var r = 0, len = roles.length; r < len; r++) {
        for (var a = 0, allowedLen = allowed.length; a < allowedLen; a++) {
            if (roles[r] === allowed[a]) {
                return true;
            }
        }
    }
    return false;
}

var hereapis = {
    live: new Liwp({
        appId: process.env.PAYPAL_APP_ID,
        secret: process.env.PAYPAL_APP_SECRET,
        strictSSL: true
    }),
    sandbox: new Liwp({
        appId: 'AeoOpBB2XJWwORPT8Q7NpPQgr8eStz39tt8IsM6wRaxiRg50hdMTSgNk7rFg',
        secret: 'EDZTDBAH7SoQsPZxVAJ4n7SvVfMwWGziwLpJsvKj8Ghe8Wxm1Hg70Tt2pXP7'
    })
};


module.exports = {
    domain: function (req, res, next) {
        var d = domain.create();
        d.on('error', function (err) {
            try {
                // handle the error safely
                logger.error('Uncaught exception! %s\n%s', err.message, err.stack);
                next(err);
            } catch (x) {
                console.log(x);
            }
        });
        d.add(req);
        d.add(res);
        req.$eat = function (fn) {
            return req.activeDomain.intercept(fn);
        };
        req.activeDomain = d;
        d.run(next);

    },
    /**
     * Setup the request for PayPal Access - for example if a refresh token is used
     * to generate a new access token, it will save the new token to mongoDb when the
     * request completes.
     */
    payPalAccess: setupForPayPalAccess,
    /**
     * Make sure the request has an authenticated user and redirect to auth if not.
     */
    auth: ensureInteractive,
    /**
     * Make sure the request has an authenticated user and return an auth error if not.
     */
    apiAuth: ensureAutomatic,
    /**
     * If role verification is desired, we need to generate a closure that will first
     * call the auth function and then call us to verify roles.
     * @param roles (as individual args)
     * @returns function(req,res,next) - to be used as middleware
     */
    hasRoles: function () {
        var roles = arguments;
        return function (req, res, next) {
            if (req.user.allowedResources) {
                var allowed = req.user.allowedResources;
                if (!rolesMatch(roles, allowed)) {
                    if (req._isInteractiveAuth) {
                        res.render('errors/401');
                    } else {
                        res.json({
                            success: false,
                            message: 'Access denied'
                        }, 401);
                    }
                    return;
                }
            }
            next();
        };
    },
    ROLES: {
        ViewProducts: 'ViewProducts',
        EditProducts: 'EditProducts',
        ViewLocations: 'ViewLocations',
        EditLocations: 'EditLocations',
        ViewReports: 'ViewReports',
        EditApps: 'EditApps'
    },
    hereApiUrl: function (env, method, api) {
        if (!env || env === 'live') {
            return live(method,api);
        } else if (env === 'sandbox') {
            return sandbox(method, api);
        } else {
            throw new Error('Unknown environment requested: ' + env);
        }
    },
    hereApi: function (env) {
        if (!env || env === 'live') {
            return hereapis.live;
        } else if (env === 'sandbox') {
            return hereapis.sandbox;
        } else {
            throw new Error('Unknown environment requested: ' + env);
        }
    },
    render: function (view) {
        return function (req, res) {
            res.render(view);
        };
    }
};

function live(method, api) {
    if (api === 'payments') {
        return 'https://api.paypal.com/v1/payments/' + method;
    } else if (api === 'vault') {
        return 'https://api.paypal.com/v1/vault/' + method;
    }
    return 'https://api.paypal.com/retail/merchant/v1/' + method;
}

function sandbox(method, api) {
    if (api === 'payments') {
        return 'https://api.sandbox.paypal.com/v1/payments/' + method;
    } else if (api === 'vault') {
        return 'https://api.sandbox.paypal.com/v1/vault/' + method;
    }
    return 'https://api.sandbox.paypal.com/retail/merchant/v1/' + method;
}