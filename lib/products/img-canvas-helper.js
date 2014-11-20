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

// Adapted from
//  https://github.com/willmark/img-canvas-helper/blob/master/index.js
// so that we can install canvas globally and avoid build issues
var log = require('pine')();
var Canvas;

try {
    Canvas = require('canvas');
} catch (x) {
    log.error('Could not load canvas - image scaling not available.', x);
}

var Args = require('vargs').Constructor;

/**
 * Resizes an image where longest dimension is the shortest of width/height
 * imgsrc - string path to image to crop
 * width - integer length of longest width dimension for resized image
 * height - integer length of longest height dimension for resized image
 * callback - callback function(
 *     result - boolean true on success
 *     data - canvas object on success, Error on failure
 */
var resize = function (imgsrc, width, height, callback) {

    var args = new Args(arguments);
    checkCommonArgs(args);

    var Image = Canvas.Image, fs = require('fs');
    var img = new Image();
    img.onerror = function (err) {
        callback(err);
    };
    img.onload = function () {
        var ratio = Math.min(
                Math.min(img.width, width) / Math.max(img.width, width),
                Math.min(img.height, height) / Math.max(img.height, height)
        );

        var w = Math.round(ratio * img.width, 0);
        var h = Math.round(ratio * img.height, 0);
        var canvas = new Canvas(w, h);
        var ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.drawImage(img, 0, 0);
        callback(null, canvas);
    };
    img.src = imgsrc;
};

/**
 * Common argument checking for crop and resize
 */
function checkCommonArgs(args) {
    if (args.length < 3) {
        throw new Error('imgsrc, width, height, and callback required');
    }
    if (typeof args.at(2) !== 'number') {
        throw new Error('height required int parameter');
    }
    if (typeof args.at(1) !== 'number') {
        throw new Error('width required int parameter');
    }
    if (!args.callbackGiven()) {
        throw new Error('Callback required');
    }
}

/**
 * Helper to write canvas to an output jpeg file
 * Useful for writing manipulated image back to a file
 * canvas - canvas to write out to disk
 * outfile - string path to output file
 * callback - function (result, data)
 *    result - boolean result true on successful write
 *    data - bytes written on success, or Error on failure
 */
var writeCanvas = function (canvas, outfile, callback) {
    var fs = require('fs');
    var out = fs.createWriteStream(outfile);
    out.on('finish', function () {
        callback(true, out.bytesWritten);
    });
    var stream = canvas.createJPEGStream({
        bufsize: 2048,
        quality: 80
    });
    stream.on('error', function (err) {
        callback(false, err);
    });
    stream.on('data', function (buffer) {
        out.write(buffer);
    });
    stream.on('end', function () {
        out.end();
    });
};

module.exports = {
    resize: resize
};
