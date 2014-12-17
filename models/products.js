'use strict';

var mongoose = require('mongoose'),
    logger = require('pine')(),
    findOrCreate = require('mongoose-findorcreate'),
    ObjectId = require('mongoose').Types.ObjectId,
    uuid = require('node-uuid');

var productModel = function () {

    var modelSchema = mongoose.Schema({
        name: String,
        merchantId: mongoose.Schema.Types.ObjectId,
        products: [
            {
                name: String,
                description: String,
                photoUrl: String,
                tags: [String],
                taxRateName: String,
                // Note you'll have to go through and rename these because 'options' is not allowed
                productOptions: [String],
                price: String,
                barcode: String,
                quantityType: String,
                priceType: String,
                referenceId: String,
                variations: [
                    {
                        name: String,
                        price: String,
                        barcode: String,
                        referenceId: String
                    }
                ]
            }
        ],
        taxRates: [
            {
                rate: String,
                name: String,
                referenceId: String,
                default: Boolean
            }
        ],
        // Note you'll have to go through and rename these because 'options' is not allowed
        productOptions: [
            {
                name: String,
                select: String,
                values: [
                    {
                        price: String,
                        name: String
                    }
                ]
            }
        ],
        tags: [
            {
                name: String
            }
        ]
    });
    modelSchema.index({merchantId: 1, name: 2}, {unique: true});
    modelSchema.plugin(findOrCreate);

    function toHereApiVariations(v) {
        if (v && v.length) {
            var hapiVariations = [];
            v.forEach(function (variation) {
                hapiVariations.push({
                    name: variation.name,
                    price: variation.price,
                    barcode: variation.barcode,
                    id: variation.referenceId
                });
            });
            return hapiVariations;
        }
        return null;
    }

    function toModelVariations(v) {
        if (v && v.length) {
            var modelVariations = [];
            v.forEach(function (variation) {
                modelVariations.push({
                    name: variation.name,
                    price: variation.price,
                    barcode: variation.barcode,
                    referenceId: variation.id
                });
            });
            return modelVariations;
        }
        return null;
    }


    /**
     * Return the document as a HereAPI-compatible model
     * (mainly some key name translations)
     */
    modelSchema.methods.toHereApiModel = function () {
        var model = {
            products: [],
            taxRates: [],
            options: [],
            tags: []
        };
        (this.products || []).forEach(function (p) {
            model.products.push({
                name: p.name,
                description: p.description,
                photoUrl: p.photoUrl,
                tags: p.tags,
                taxRateName: p.taxRateName,
                options: p.productOptions,
                price: p.price,
                quantityType: p.quantityType,
                priceType: p.priceType,
                id: p.referenceId,
                barcode: p.barcode,
                variations: toHereApiVariations(p.variations)
            });
        });
        (this.taxRates || []).forEach(function (t) {
            model.taxRates.push({
                rate: t.rate,
                name: t.name,
                id: t.referenceId,
                default: t.default
            });
        });
        (this.tags || []).forEach(function (t) {
            model.tags.push({
                name: t.name
            });
        });
        (this.productOptions || []).forEach(function (po) {
            var newOption = {
                name: po.name,
                select: po.select,
                values: []
            };
            if (po.values) {
                for (var pv = 0; pv < po.values.length; pv++) {
                    newOption.values.push({
                        name: po.values[pv].name,
                        price: po.values[pv].price
                    });
                }
            }
            model.options.push(newOption);
        });
        return model;
    };

    /**
     * Apply a HereAPI product model to a MongoDB product model
     * @param model The HereAPI model
     */
    modelSchema.methods.fromHereAPIModel = function (model) {
        this.products = [];
        this.taxRates = [];
        this.productOptions = [];
        this.tags = [];

        var _this = this;
        (model.products || []).forEach(function (p) {
            _this.products.push({
                name: p.name,
                description: p.description,
                photoUrl: p.photoUrl,
                tags: p.tags,
                taxRateName: p.taxRateName,
                productOptions: p.options,
                price: p.price,
                quantityType: p.quantityType,
                priceType: p.priceType,
                referenceId: p.id,
                variations: toModelVariations(p.variations)
            });
        });
        (model.taxRates || []).forEach(function (t) {
            _this.taxRates.push({
                rate: t.rate,
                name: t.name,
                referenceId: t.id,
                default: t.default
            });
        });
        (model.tags || []).forEach(function (t) {
            _this.tags.push({
                name: t.name
            });
        });
        (model.options || []).forEach(function (po) {
            var newOption = {
                name: po.name,
                select: po.select,
                values: []
            };
            if (po.values) {
                for (var pv = 0; pv < po.values.length; pv++) {
                    newOption.values.push({
                        name: po.values[pv].name,
                        price: po.values[pv].price
                    });
                }
            }
            _this.productOptions.push(newOption);
        });
    };

    modelSchema.statics.getHereApiModel = function (req, next) {
        var url = req.hereApiUrl('products');
        req.hereApi().get({
            tokens: req.user.tokens(),
            url: url,
            json: true,
            headers: {
                'Content-type': 'application/json'
            }
        }, req.$eat(function (json) {
            if (json.errorCode) {
                logger.error('Failed to get products:\n%j', json);
                next(new Error('Failed to retrieve products.'));
                return;
            }
            next(null, json);
        }));
    };

    modelSchema.statics.getLocalOrRemoteModelById = function (req, id, cb) {
        if (id === '_' || id === '-') {
            module.exports.getHereApiModel(req, cb);
        } else {
            mongoose.models.ProductModel.findOne({merchantId: req.user.entity._id, _id: new ObjectId(id)}, function (e, d) {
                if (d) {
                    d = d.toHereApiModel();
                }
                cb(e, d);
            });
        }
    };
    return mongoose.model('ProductModel', modelSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.ProductModel || new productModel();
