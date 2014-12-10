'use strict';
var appUtils = require('../lib/appUtils');
var Image = require('../models/image');

module.exports = function (router) {

    router.use(appUtils.domain);

    /**
     * Fetch an image from MongoDB given it's document id
     */
    router.get('/:imageId', function (req, res) {
        Image.findById(req.params.imageId, req.$eat(function (doc) {
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