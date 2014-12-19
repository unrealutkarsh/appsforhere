var Hardware = function (locationManager) {
    this.devices = [];
    this.locationManager = locationManager;
};

$.extend(Hardware.prototype, $.eventEmitter);

Hardware.prototype.setup = function (prefs) {
    var self = this;
    if (prefs.get('hardware')) {
        this.device = prefs.get('hardware');
    }
    this.ladda = Ladda.create($('#hardwareSelect>button')[0]);
    this.select = $('#hardwareSelect');
    this.select.on('click', 'li>a', function (e) {
        e.preventDefault();
        $('li',self.select).removeClass('active');
        $(this).addClass('active');
        $('span.selectedDevice', self.select).text($(this).text());
        for (var i = 0; i < self.devices.length; i++) {
            if (self.devices[i]._id === this.id) {
                self.device = self.devices[i];
                prefs.set('hardware', self.device);
                break;
            }
        }
        self.emit('changed',self.device);
    });
};

Hardware.prototype.load = function () {
    var loc = this.locationManager.getCurrentLocation(), self = this;
    this.ladda.start();
    if (loc) {
        $.ajax({
            url: '/devices/all/' + loc.id,
            type: 'GET',
            error: function (r, msg, e) {
                console.log('Hardware lookup error', e);
            },
            success: function (res) {
                self.ladda.stop();
                if (res && res.devices && res.devices.length) {
                    self.devices = res.devices;
                    if (!self.select.data('moved')) {
                        self.select.appendTo('#navbar-right');
                        self.select.data('moved', true);
                    }
                    // TODO remove existing devices when list is changed.
                    for (var i = 0; i < res.devices.length; i++) {
                        var d = res.devices[i];
                        if ($('#'+ d._id).length === 0) {
                            var li = $('<li/>');
                            var a = $('<a/>', {text: d.name|| d.id,id: d._id});
                            if (self.device && self.device._id === d._id) {
                                li.addClass('active');
                                $('span.selectedDevice',self.select).text(self.device.name||self.device.deviceId);
                                self.emit('changed', self.device);
                            }
                            li.append(a);
                            $('ul',self.select).append(li);
                        }
                    }
                }
            }
        });
    }
};

Hardware.prototype.spinner = function (on) {
    this.ladda[on?'start':'stop']();
};

module.exports = Hardware;
