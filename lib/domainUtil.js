'use strict';

var domain = require('domain');
var logger = require('pine')();
var assert = require('assert');
var PayPalUser = null;
var PayPalDelegatedUser = null;

function wrapController(fn) {
    return function (req, res, next) {
        var d = domain.create();
        d.on('error', function (err) {
            // handle the error safely
            logger.error('Uncaught exception! %s\n%s%d', err, err.stack, err);
            next(err);
        });
        req.activeDomain = d;
        req.$eat = function (fn) {
            return req.activeDomain.intercept(fn);
        };
        d.run(function () {
            fn(req, res, next);
        });
    };
}

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

function setupForPayPalAccess(req) {
    // Since we store encrypted refresh tokens, if the LoginWithPayPal
    // infrastructure needs to refresh a token, we need access to the
    // request cookies to decrypt them.
    if (req.user) {
        req.user.refresh_token = function (user, cb) {
            logger.verbose('Refreshing access token.');
            if (!PayPalUser) {
                // This is here to avoid a cyclical require that causes mongoose to get confused
                PayPalUser = require('../models/paypalUser');
                PayPalDelegatedUser = require('../models/paypalDelegatedUser');
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
}

function ensureAuth(isInteractive, req, res, next) {
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

/**
 * If role verification is desired, we need to generate a closure that will first
 * call the auth function and then call us to verify roles.
 * @param roles
 * @param auth
 * @returns {*}
 */
function ensureRoleFunction(roles, isInteractive) {
    if (!roles) {
        return isInteractive ? ensureInteractive : ensureAutomatic;
    }
    return function (req, res, next) {
        ensureAuth(isInteractive, req, res, function () {
            if (req.user.allowedResources) {
                var allowed = req.user.allowedResources;
                if (!rolesMatch(roles, allowed)) {
                    if (isInteractive) {
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
        });
    };
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

module.exports = {
    for: function (app) {
        if (!app.getWithDomain) {
            app.setupForPayPalAccess = setupForPayPalAccess;
            ['get', 'post', 'put', 'delete', 'patch'].forEach(function (verb) {
                app[verb + 'WithDomain'] = function (resource, callback, explicitNext) {
                    if (explicitNext) {
                        // This handles passport controllers basically. Where the fn
                        // is called as app.get(resource, passport.auth(...), realRouteFn);
                        app[verb](resource, callback, wrapController(explicitNext));
                    } else {
                        app[verb](resource, wrapController(callback));
                    }
                };
                app[verb + 'WithDomainAndAuth'] = function (resource, roles, callback) {
                    if (typeof(roles) === 'function') {
                        callback = roles;
                        roles = null;
                    }
                    app[verb](resource, ensureRoleFunction(roles, false), wrapController(callback));
                };
                app[verb + 'WithDomainAndInteractiveAuth'] = function (resource, roles, callback) {
                    if (typeof(roles) === 'function') {
                        callback = roles;
                        roles = null;
                    }
                    app[verb](resource, ensureRoleFunction(roles, true), wrapController(callback));
                };
            });
        }
    }
};