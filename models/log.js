'use strict';

var mongoose = require('mongoose');

var logModel = function () {

    var logSchema = mongoose.Schema({
        message: String,
        level: String,
        hostname: String,
        timestamp: Date,
        meta: mongoose.Schema.Types.Mixed
    },{
        capped: 20000000
    });

    return mongoose.model('nodelogs', logSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.nodelogs || new logModel();
