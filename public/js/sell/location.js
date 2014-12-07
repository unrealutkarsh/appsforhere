var Location = function () {
    this.locationFieldSelector = '#location';
};

$.extend(Location.prototype, $.eventEmitter);

Location.prototype.setup = function (prefs) {
    var self = this;
    if (prefs.get('locationId')) {
        this.locationId = prefs.get('locationId');
    }
    this.locationSelectize = $(this.locationFieldSelector).selectize({
        maxItems: 1,
        persist: false,
        openOnFocus: true,
        valueField: 'id',
        labelField: 'name',
        searchField: ['name'],
        create: false,
        preload: true,
        load: function (query, callback) {
            $.ajax({
                url: '/locations/api?format=json',
                type: 'GET',
                error: function() {
                    callback();
                },
                success: function(res) {
                    var s = self.locationSelectize[0].selectize;
                    callback(res.locations);
                    self.locations = res.locations;
                    if (s.getValue().length == 0 && res.locations && res.locations.length > 0) {
                        if (self.locationId) {
                            for (var i = 0; i < res.locations.length; i++) {
                                if (res.locations[i].id === self.locationId) {
                                    s.setValue(self.locationId);
                                    self.emit('selected', res.locations[i]);
                                    return;
                                }
                            }
                        }
                        // Oh well, pick the first one.
                        s.setValue(res.locations[0].id);
                        self.emit('selected', res.locations[0]);
                    }
                }
            });
        }
    });

    this.locationSelectize[0].selectize.on('change', function () {
        var loc = self.getCurrentLocation();
        if (loc) {
            prefs.set('locationId', loc.id);
            self.emit('selected', loc);
        }
    });
};

Location.prototype.getCurrentLocation = function () {
    var l = this.locationSelectize[0].selectize.getValue();
    for (var i = 0; i < this.locations.length; i++) {
        var loc = this.locations[i];
        if (loc.id === l) {
            return loc;
        }
    }
    return null;
};

Location.prototype.getBrowserLocation = function () {
    var self = this;
    $('#pleaseWaitDialog').modal();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            self.coords = position.coords;
            $('#pleaseWaitDialog').modal('hide');
        }, function () { self.locationError(); });
    } else {
        this.locationError();
    }
};

Location.prototype.browserLocationError = function () {
    alert('Your location is required to use this application.');
}

module.exports = Location;
