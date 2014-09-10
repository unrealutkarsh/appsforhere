'use strict';

var logger = require('pine')();
var httpunch = require('httpunch');
var Liwp = require('node-liwp');
var Cookie = require('cookie-jar');
var _ = require('underscore');

var inflight = {};

function readCookies(expressRequest, cookieResponse) {
    var cookieJar = new Cookie.Jar();
    if (expressRequest.session.reportingCookies) {
        expressRequest.session.reportingCookies.forEach(function (c) {
            cookieJar.add(new Cookie(c));
        });
    }
    if (cookieResponse.headers && cookieResponse.headers['set-cookie']) {
        cookieResponse.headers['set-cookie'].forEach(function (c) {
            cookieJar.add(new Cookie(c));
        });
    }
    // Store the cookies for later
    saveToSession(expressRequest, cookieJar);
}

function saveToSession(expressRequest, jar) {
    var sArr = [];
    jar.cookies.forEach(function (c) {
        sArr.push(c.toString());
    });
    expressRequest.session.reportingCookies = sArr;
}

function addCookiesToRequest(expressRequest, request) {
    if (expressRequest.session.reportingCookies) {
        // Apply the cookies to the httpunch request
        var jar = new Cookie.Jar();
        expressRequest.session.reportingCookies.forEach(function (cstr) {
            if (typeof(cstr) === 'string') {
                jar.add(new Cookie(cstr));
            }
        });
        var ck = jar.get(request);
        if (ck && ck.length) {
            var vals = [];
            ck.forEach(function (cookie) {
                vals.push(cookie.name + '=' + cookie.value);
            });
            request.headers = request.headers || {};
            request.headers.cookie = vals.join(';') + ';';
        }
    }
}

function doReportingRequest(expressRequest, urlOrReportingRequestOptions, callback) {
    if (typeof(urlOrReportingRequestOptions) === 'string') {
        urlOrReportingRequestOptions = {
            url: urlOrReportingRequestOptions
        };
    }
    var rq = _.clone(urlOrReportingRequestOptions);
    var url = rq.url;
    addCookiesToRequest(expressRequest, rq);
    rq.secureProtocol = 'TLSv1_method';

    httpunch.get(rq, function (err, result) {
        if (err) {
            logger.error('Reporting request failed: %s', err.message);
            callback(err);
        } else if (result.statusCode === 401) {
            if (urlOrReportingRequestOptions._alreadyReauthed) {
                callback(new Error('Reporting authentication failed: ' + result.statusCode));
            } else {
                var doneFn = function (authErr) {
                    if (authErr) {
                        callback(authErr);
                    } else {
                        // httpunch or somebody mucks with the URL and removes it, but cookie jar needs it.
                        rq.url = url;
                        doReportingRequest(expressRequest, urlOrReportingRequestOptions, callback);
                    }
                };

                if (inflight[expressRequest.user.profileId]) {
                    inflight[expressRequest.user.profileId].listeners.push(doneFn);
                    logger.debug('Queueing completion handler for reporting auth (%d).', inflight[expressRequest.user.profileId].listeners.length);
                    return;
                }
                logger.debug('Starting reporting auth');
                readCookies(expressRequest, result);
                var info = JSON.parse(result.body.toString());
                urlOrReportingRequestOptions._alreadyReauthed = true;
                startReportingAuth(expressRequest, info, doneFn);
            }
        } else {
            callback(err, result);
        }
    });
}

function doCallbacks(info, e) {
    info.listeners.forEach(function (cb) {
        try {
            cb(e);
        } catch (x) {
            logger.error('Failed to invoke completion handler for reporting request: %s\n%s', x.message, x.stack);
        }
    });
    delete inflight[info.id];
}

/**
 * Use the current user access_token to get a reporting server cookie
 * @param req the express request
 * @param info the auth info from reporting
 * @param cb the callback which only takes an error object (reporting server cookies will be stored in the session)
 */
function startReportingAuth(req, info, cb) {
    var listenerInfo = inflight[req.user.profileId] = {listeners:[cb],id:req.user.profileId};
    // Make a cheap call to identity to make sure our token is fresh
    req.user.hereApi().get({
        tokens: req.user,
        json: true,
        url: 'https://api.paypal.com/v1/identity/openidconnect/userinfo/?schema=openid&access_token='+req.user.access_token
    }, function (uiErr, uiRz) {
        if (uiErr) {
            logger.error('Reporting auth identity error: %s', uiErr.message);
            doCallbacks(listenerInfo, uiErr);
        } else if (!uiRz || !uiRz.email) {
            logger.error('Reporting auth identity failed: %j', uiRz);
            doCallbacks(listenerInfo, new Error('Failed to get user details during reporting'));
        } else {
            completeAuth(req, info, function (e) {
                doCallbacks(listenerInfo, e);
            });
        }
    });
}

/**
 * Call the reporting server given a fresh access token and the appropriate returnUrl from
 * the original reporting server call (which likely got a 401)
 */
function completeAuth(expressRequest, info, cb) {
    var url = info.returnUrl + '?access_token=' + encodeURIComponent(expressRequest.user.access_token);
    doReportingRequest(expressRequest, url, function (authErr, authRz) {
        if (authErr) {
            logger.error('Reporting auth completion error: %s', authErr.message);
            cb(authErr);
        } else if (authRz.statusCode !== 200) {
            logger.error('Unknown result from reporting handshake: %s\n%s', authRz.statusCode, authRz.body?authRz.body.toString():'empty body');
            cb(new Error('Unknown result from PayPal Reporting handshake: ' + authRz.statusCode));
        } else {
            readCookies(expressRequest, authRz);
            cb();
        }
    });
}

module.exports = {
    request: doReportingRequest,
    today: function () {
        var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
        return [d.getFullYear(), m < 10 ? ('0' + m) : m, day < 10 ? ('0' + day) : day].join('-');
    },
    /**
     * The sales reporting API formats are incredibly verbose. The transformers can help.
     */
    transformers: {
        daily: function (rz) {

        }
    }
};
