'use strict';

var logger = require('pine')();
var appUtils = require('appUtils');
var Product = require('../models/products');
var httpunch = require('httpunch');
var async = require('async');
var fs = require('fs');
var csv = require('csv');
var ModelParser = require('../lib/products/modelParser');
var ObjectId = require('mongoose').Types.ObjectId;
var Canvas = require('canvas'),
    Image = Canvas.Image,
    imgHelper = require('../lib/products/img-canvas-helper');

module.exports = function (router) {

    router.use(appUtils.domain);

    router.get('/', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res) {
        res.render('products/index');
    });

    router.get('/:modelId', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res) {
        if (req.params.modelId === '_') {
            res.render('products');
        } else {
            getModelByNameOrId(req, res, req.params.modelId, function (doc) {
                res.render('products', {modelId: doc.id, modelName: doc.name});
            });
        }
    });

    router.get('/:modelId/xls', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res) {
        if (req.params.modelId === '_') {
            req.user.hereApi().get({
                tokens: req.user,
                url: 'https://www.paypal.com/webapps/hereapi/merchant/v1/products',
                json: true,
                headers: {
                    'Content-type': 'application/json'
                }
            }, req.$eat(function (json, response) {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats');
                res.setHeader('Content-Disposition', 'attachment; filename=PayPalHere-Items.xlsx');
                res.end(ModelParser.toXLSX(json), 'binary');
            }));
        } else {
            getModelByNameOrId(req, res, req.params.modelId, function (doc) {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats');
                var filename = req.params.modelId.replace(/[^a-z0-9\s_\-]/gi, '');
                res.setHeader('Content-Disposition', 'attachment; filename=PayPalHere-Items-' + filename + '.xlsx');
                res.end(ModelParser.toXLSX(doc.toHereApiModel()), 'binary');
            });
        }
    });

    router.get('/api/model/:id', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res, next) {
        if (req.params.id && req.params.id !== '_') {
            Product.ProductModel.findOne({merchantId: req.user._id, _id: new ObjectId(req.params.id)}, req.$eat(function (doc) {
                if (!doc) {
                    res.send({success: false}, 404);
                } else {
                    Product.ProductModel.find({merchantId: req.user._id}).select('name').exec(req.$eat(function (docs) {
                        var json = doc.toHereApiModel();
                        json._savedModels = makeSavedModels(docs);
                        res.send(json);
                    }));
                }
            }));
        } else {
            getModel(req, res, next);
        }
    });

    router.get('/api/catalogs', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res) {
        Product.ProductModel.find({merchantId: req.user._id}).select('name').exec(req.$eat(function (docs) {
            var rz = {catalogs: [
                {text: 'PayPal Here', value: '-'}
            ]};
            docs.forEach(function (c) {
                if (c.name !== 'PayPal Here') {
                    rz.catalogs.push({text: c.name, value: c._id});
                }
            });
            res.json(rz);
        }));
    });

    router.get('/api/catalogs/:id/tags', appUtils.auth, appUtils.hasRoles('ViewProducts'), function (req, res) {
        if (req.params.id === '-') {
            Product.getHereApiModel(req, function (err, model) {
                res.json({tags: model.tags});
            });
        } else {
            Product.ProductModel.findOne({merchantId: req.user._id, _id: req.params.id}, req.$eat(function (doc) {
                res.json({tags: doc.tags});
            }));
        }
    });

    router.post('/import', appUtils.apiAuth, appUtils.hasRoles('EditProducts'), function (req, res, next) {
        if (req.files.csvupload) {
            fs.readFile(req.files.csvupload.path, req.$eat(function (data) {
                csv.parse(data.toString(), req.$eat(function (rows) {
                    var model = new ModelParser().parse(rows);
                    saveModel(req, res, model);
                }));
            }));
        } else {
            fs.readFile(req.files.xlsupload.path, req.$eat(function (data) {
                new ModelParser().parseXLS(data, req.$eat(function (newModel) {
                    saveModel(req, res, newModel);
                }));
            }));
        }
    });

    router.get('/new/:modelName', appUtils.auth, appUtils.hasRoles('EditProducts'), function (req, res) {
        if (req.params.modelName === 'PayPal Here') {
            res.redirect('/products');
            return;
        }
        var newModel = Product.ProductModel({
            merchantId: req.user._id,
            name: req.params.modelName
        });
        newModel.save(req.$eat(function () {
            res.redirect('/products/' + newModel.id);
        }));
    });

    router.post('/publish', appUtils.auth, appUtils.hasRoles('EditProducts'), function (req, res) {
        var model = JSON.parse(req.body.model);
        putModel(req, model, function (err) {
            res.json({
                success: !err,
                message: err
            });
        });
    });

    router.post('/save', appUtils.auth, appUtils.hasRoles('EditProducts'), function (req, res, next) {
        if (!req.body.name) {
            res.json({success: false, message: 'Missing catalog name'}, 500);
            return;
        }
        var model = JSON.parse(req.body.model);
        Product.ProductModel.findOrCreate({
            merchantId: req.user._id,
            name: req.body.name
        }, {}, req.$eat(function (doc) {
            doc.fromHereAPIModel(model);
            doc.save(req.$eat(function () {
                res.json({success: true});
            }));
        }));
    });

    router.post('/image', appUtils.auth, appUtils.hasRoles('EditProducts'), function (req, res, next) {
        fs.readFile(req.files.imageupload.path, req.$eat(function (data) {
            imgHelper.resize(data, 200, 200, req.$eat(function (thumb) {
                thumb.toBuffer(req.$eat(function (thumbBuffer) {
                    var hash = require('crypto').createHash('sha512').update(data).digest('hex');
                    Product.Image.findOrCreate({ hash: hash },
                        {
                            width: thumb.width,
                            height: thumb.height,
                            png: thumbBuffer,
                            originalImage: data
                        },
                        { upsert: true },
                        req.$eat(function (imageDoc) {
                            res.json({
                                url: 'https://' + req.headers.host + '/image/' + imageDoc.id
                            });
                        }));
                }));
            }));
        }));
    });
};

function makeSavedModels(docs) {
    var models = [
        {id: '_', name: 'PayPal Here'}
    ];
    if (docs) {
        docs.forEach(function (d) {
            models.push({
                id: d.id,
                name: d.name
            });
        });
    }
    return models;
}

function getModel(req, res, next) {
    Product.ProductModel.find({merchantId: req.user._id}).select('name').exec(req.$eat(function (docs) {
        Product.getHereApiModel(req, function (err, model) {
            if (err) {
                next(err);
            } else {
                model._savedModels = makeSavedModels(docs);
                res.send(model);
            }
        });
    }));
}

function getModelByNameOrId(req, res, modelNameOrId, successCallback) {
    var byName = function () {
        Product.ProductModel.findOne({merchantId: req.user._id, name: modelNameOrId}, req.$eat(function (doc) {
            if (!doc) {
                logger.warn('Attempted to access unknown model by name ' + modelNameOrId);
                res.render('errors/404', 404);
            } else {
                successCallback(doc);
            }
        }));
    };
    if (ObjectId.isValid(modelNameOrId)) {
        Product.ProductModel.findOne({merchantId: req.user._id, _id: new ObjectId(modelNameOrId)}, req.$eat(function (doc) {
            if (!doc) {
                byName();
            } else {
                successCallback(doc);
            }
        }));
        return;
    } else {
        byName();
    }
}

function putModel(req, model, fn) {
    var url = 'https://www.paypal.com/webapps/hereapi/merchant/v1/products';
    req.user.hereApi().put({
        tokens: req.user,
        url: url,
        json: true,
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify(model)
    }, req.$eat(function (json, response) {
        if (json && json.errorCode) {
            if (json.developerMessage) {
                fn(json.message + ' - ' + json.developerMessage);
            } else {
                fn(json.message);
            }
        } else {
            fn();
        }
    }));
}


function saveModel(req, res, model) {
    if (req.body.modelId !== '_') {
        // Save to a local model
        Product.ProductModel.findOne({_id: req.body.modelId}, req.$eat(function (exModel) {
            exModel.fromHereAPIModel(model);
            exModel.save(req.$eat(function () {
                res.json({success: true});
            }));
        }));
    } else {
        // Straight to PPH
        putModel(req, model, req.$eat(function () {
            res.json({success: true});
        }));
    }
}