'use strict';

var mongoose = require('mongoose');

var vaultModel = function () {

    var vaultSchema = mongoose.Schema({
        card_id: String,
        short_code: {type:String,unique:true},
        referenceId: String,
        profileId: String,
        timestamp: Date,
        valid_until: String,
        number: String
    });

    return mongoose.model('vault', vaultSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.vault || new vaultModel();