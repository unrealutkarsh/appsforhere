'use strict';
var appUtils = require('appUtils');
var Product = require('../models/products');

module.exports = function (router) {

    router.use(appUtils.domain);

    router.get('/:imageId', function (req, res) {
        Product.Image.findById(req.params.imageId, req.$eat(function (doc) {
            if (!doc) {
                res.status(404);
                res.render('errors/404');
                return;
            }
            res.type('png');
            res.send(doc.png);
        }));
    });
};