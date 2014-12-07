'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate');

var savedOrderModel = function () {

    var orderSchema = mongoose.Schema({
        locationId: {type:String,index:true},
        profileId: String,
        name: String,
        invoiceId: String
    });

    orderSchema.plugin(findOrCreate);

    return mongoose.model('SavedOrder', orderSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.SavedOrder || new savedOrderModel();
