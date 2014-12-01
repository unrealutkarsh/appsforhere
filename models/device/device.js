'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate');

var deviceModel = function () {

    var deviceSchema = mongoose.Schema({
        key: {type:String,index:true},
        deviceId: String,
        host: String,
        available: Boolean,
        support:[String]
    });

    deviceSchema.index({key: 1, deviceId: 2}, {unique: true});
    deviceSchema.plugin(findOrCreate);

    return mongoose.model('Device', deviceSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.Device || new deviceModel();