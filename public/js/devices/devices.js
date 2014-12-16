$(function () {
    var locationSelectize = $('#location').selectize({
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
                    var s = locationSelectize[0].selectize;
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
                    }
                }
            });
        }
    });
});