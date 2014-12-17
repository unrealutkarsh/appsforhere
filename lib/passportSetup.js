'use strict';

var appUtils = require('./appUtils'),
    PayPalStrategy = require('./payPalStrategy'),
    Token = require('../models/token'),
    PayPalUser = require('../models/payPalUser'),
    PayPalDelegatedUser = require('../models/payPalDelegatedUser'),
    passport = require('passport');

/**
 * Configure the passport strategies for live and for sandbox
 * @param config from Kraken/confit
 */
module.exports = function configurePassport(config) {
    passport.use(new PayPalStrategy({
            clientID: config.get('loginWithPayPal').live.client_id,
            clientSecret: config.get('loginWithPayPal').live.secret,
            callbackURL: config.get('loginWithPayPal').live.return_url || 'https://appsforhere.ebayc3.com/oauth/return',
            passReqToCallback: true
        },
        function savePassportUserToMongo(req, accessToken, refreshToken, profile, done) {
            Token.encryptRefreshToken(refreshToken, req.res, function (error, enc_token) {
                if (error) {
                    done(error);
                    return;
                }
                PayPalUser.findOrCreate({profileId: profile.id},
                    {
                        email: profile.emails[0].value,
                        currency: profile.currency,
                        country: profile.country
                    },
                    {upsert: true},
                    function (err, user) {
                        if (err) {
                            return done(err, user);
                        }
                        var token = new Token({
                            access_token: accessToken,
                            encrypted_refresh_token: enc_token,
                            user_document_id: user._id,
                            last_used: new Date()
                        });
                        token.save(function (tokErr, tokDoc) {
                            return done(tokErr, {account: user, token: tokDoc});
                        });
                    });
            });
        }
    ));

    passport.use(new PayPalStrategy({
            name: 'sandbox',
            clientID: config.get('loginWithPayPal').sandbox.client_id,
            clientSecret: config.get('loginWithPayPal').sandbox.secret,
            callbackURL: config.get('loginWithPayPal').sandbox.return_url || 'https://appsforhere.ebayc3.com/oauth/return',
            authorizationURL: 'https://www.sandbox.paypal.com/webapps/auth/protocol/openidconnect/v1/authorize',
            tokenURL: 'https://api.sandbox.paypal.com/v1/identity/openidconnect/tokenservice',
            profileURL: 'https://api.sandbox.paypal.com/v1/identity/openidconnect/userinfo/?schema=openid',
            statusURL: 'https://api.sandbox.paypal.com/retail/merchant/v1/status',
            hereApi: appUtils.hereApis.sandbox,
            passReqToCallback: true
        },
        function saveSandboxPassportUserToMongo(req, accessToken, refreshToken, profile, done) {
            Token.encryptRefreshToken(refreshToken, req.res, function (error, enc_token) {
                if (error) {
                    done(error);
                    return;
                }
                PayPalUser.findOrCreate({profileId: 'sandbox-' + profile.id},
                    {
                        email: profile.emails[0].value,
                        currency: profile.currency,
                        country: profile.country,
                        environment: 'sandbox'
                    },
                    {upsert: true},
                    function (err, user) {
                        if (err) {
                            return done(err, user);
                        }
                        var token = new Token({
                            access_token: accessToken,
                            encrypted_refresh_token: enc_token,
                            user_document_id: user._id,
                            last_used: new Date()
                        });
                        token.save(function (tokErr, tokDoc) {
                            return done(tokErr, {user: user, token: tokDoc});
                        });
                    });
            });
        }));

    passport.serializeUser(function serializePassportUser(user, done) {
        var serialized;
        if (user.delegate) {
            serialized = 'delegate*' + user.delegate.id + '*' + user.token.id;
        } else {
            serialized = user.account.id + '*' + user.token.id;
        }
        console.log('SERIALIZED ID:', serialized);
        done(null, serialized);
    });

    passport.deserializeUser(function deserializePassportUser(id, done) {
        var parts = id.split('*');
        if (parts.length === 2) {
            // first person
            Token.findOne({_id: parts[1]}, function (err, token) {
                if (err) {
                    return done(err);
                }
                PayPalUser.findOne({_id: parts[0]}, function (ppuErr, ppu) {
                    if (ppuErr) {
                        return done(ppuErr);
                    }
                    ppu.token = token;
                    token.user = ppu;
                    done(null, ppu);
                });
            });
        } else if (parts.length === 3) {
            // delegate
            Token.findOne({_id: parts[2]}, function (err, token) {
                if (err) {
                    return done(err);
                }
                PayPalDelegatedUser.findOne({_id: parts[1]}, function (ppuErr, ppu) {
                    if (ppuErr) {
                        return done(ppuErr);
                    }
                    ppu.token = token;
                    token.user = ppu;
                    done(null, ppu);
                });
            });
        } else {
            done(new Error('Invalid passport user token ' + id));
        }
    });
};
