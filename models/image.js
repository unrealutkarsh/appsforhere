'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate');

var imageModel = function () {

    var imageSchema = mongoose.Schema({
        // We want full randomness...
        hash: {type: String, index: true},
        width: Number,
        height: Number,
        png: Buffer,
        originalImage: Buffer
    });

    imageSchema.plugin(findOrCreate);

    return mongoose.model('Image', imageSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.Image || new imageModel();