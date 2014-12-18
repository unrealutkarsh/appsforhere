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
/* global dust */
'use strict';

var accounting = require('accounting');
var BigNumber = require('bignumber.js');
var Invoice = require('paypal-invoice');

var currencyInfo = {
    'USD': {
        symbol: '$'
    },
    'GBP': {
        symbol: '£'
    },
    'AUD': {
        symbol: '$'
    }
};

(function (dust) {

    function valueIsInList(val, list, delim, caseSensitive) {
        list = (list || '').split(delim);
        if (!caseSensitive) {
            for (var i = 0; i < list.length; i++) {
                list[i] = list[i].toLowerCase();
            }
            val = val ? val.toLowerCase() : null;
        }
        return list.indexOf(val) >= 0;
    }

    function membership(checkForIn, chunk, context, bodies, params) {
        var list = dust.helpers.tap(params.list, chunk, context),
            val = dust.helpers.tap(params.value, chunk, context),
            delim = ',',
            caseSensitive = false;
        if (params.delimeter) {
            delim = dust.helpers.tap(params.delimeter, chunk, context);
        }
        if (params.caseSensitive) {
            caseSensitive = dust.helpers.tap(params.caseSensitive, chunk, context) ? true : false;
        }
        var isInList = valueIsInList(val, list, delim, caseSensitive);
        return doMembership(isInList === checkForIn, bodies, chunk, context);
    }

    function doMembership(renderBlock, bodies, chunk, context) {
        if (renderBlock) {
            if (bodies.block) {
                return chunk.render(bodies.block, context);
            }
        } else if (bodies.else) {
            return chunk.render(bodies.else, context);
        }
        return chunk;
    }

    var helpers = {
        money: function (chunk, context, bodies, params) {
            var amt = dust.helpers.tap((params && params.key) ? params.key : bodies.block, chunk, context),
                cur = 'USD';
            if (params && params.code) {
                cur = dust.helpers.tap(params.code, chunk, context);
            }
            if (amt instanceof BigNumber) {
                amt = amt.toString();
            }
            return chunk.write(accounting.formatMoney(amt, currencyInfo[cur].symbol));
        },
        currencySymbol: function (chunk, context, bodies, params) {
            var cur = 'USD';
            if (params && params.code) {
                cur = dust.helpers.tap(params.code, chunk, context);
            }
            console.log('CODE',cur);
            return chunk.write(currencyInfo[cur].symbol);
        },
        amtEq: function (chunk, context, bodies, params) {
            var amt = dust.helpers.tap(params.key, chunk, context),
                val = dust.helpers.tap(params.value, chunk, context);
            if (new BigNumber(amt).equals(val)) {
                return chunk.render(bodies.block, context);
            } else if (bodies.else) {
                return chunk.render(bodies.else, context);
            }
            return chunk;
        },
        amtNe: function (chunk, context, bodies, params) {
            var amt = dust.helpers.tap(params.key, chunk, context),
                val = dust.helpers.tap(params.value, chunk, context);
            if (!new BigNumber(amt).equals(val)) {
                return chunk.render(bodies.block, context);
            } else if (bodies.else) {
                return chunk.render(bodies.else, context);
            }
            return chunk;
        },
        in: function (chunk, context, bodies, params) {
            return membership(true, chunk, context, bodies, params);
        },
        notIn: function (chunk, context, bodies, params) {
            return membership(false, chunk, context, bodies, params);
        },
        invoiceTotals: function (chunk, context, bodies, params) {
            var inv = dust.helpers.tap(params.key, chunk, context);
            if (!(inv instanceof Invoice)) {
                inv = new Invoice(inv);
            }
            return bodies.block(chunk, context.push(inv.calculate()));
        }
    };

    for (var h in helpers) {
        dust.helpers[h] = helpers[h];
    }
})(typeof exports !== 'undefined' ? module.exports = require('dustjs-linkedin') : dust);
