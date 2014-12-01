'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate');

var devicePermissionModel = function () {

    var devicePermSchema = mongoose.Schema({
        profileId: {type:String,index:true},
        key: String
    });

    devicePermSchema.plugin(findOrCreate);

    return mongoose.model('DevicePermission', devicePermSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.DevicePermission || new devicePermissionModel();