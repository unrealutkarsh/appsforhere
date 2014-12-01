'use strict';

var mongoose = require('mongoose'),
    findOrCreate = require('mongoose-findorcreate');

var devicePreferenceSchema = function () {

    var devicePrefSchema = mongoose.Schema({
        permissionId: {type:mongoose.Schema.Types.ObjectId,index:true},
        deviceId: String,
        name: String
    });

    devicePrefSchema.plugin(findOrCreate);

    return mongoose.model('DevicePreference', devicePrefSchema);
};

// In case you somehow require this twice when it thinks they're separate modules.
module.exports = mongoose.models.DevicePreference || new devicePreferenceSchema();