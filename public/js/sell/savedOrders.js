var SavedOrder = function (locationManager, invoiceManager) {
    this.locationManager = locationManager;
    this.invoiceManager = invoiceManager;
    this.buttonGroupSelector = '#savedOrderSelect';
};

SavedOrder.prototype.setup = function () {
    var self = this;
    this.buttonGroup = $(this.buttonGroupSelector);
    this.invoiceManager.on('clear', function () {
        self.savedOrderName = null;
        self.update();
        $('#orderName').prop('disabled',false);
    });
    $(this.buttonGroup).on('click', 'li>a', function (e) {
        e.preventDefault();
        var name = $(this).text();
        $('#savedOrderDialog').modal();
        $.ajax({
            url: '/sell/load/' + this.parentNode.id,
            type: 'GET',
            error: function (r, msg, e) {
                $('#savedOrderDialog').modal('hide');
                alert('Failed: ', msg);
            },
            success: function (res) {
                $('#savedOrderDialog').modal('hide');
                self.invoiceManager.newOrder(new Invoice(res), name);
                self.invoiceManager.invoice.invoiceID = res.invoiceID;
                self.savedOrderName = name;
                $('#orderName').val(name);
                $('#orderName').prop('disabled',true);
            }
        });
    });
};

SavedOrder.prototype.update = function () {
    var loc = this.locationManager.getCurrentLocation(), self = this;
    if (loc) {
        $.ajax({
            url: '/sell/saved/' + loc.id,
            type: 'GET',
            error: function (r, msg, e) {
                console.log('Saved order lookup error', e);
            },
            success: function (res) {
                if (!self.buttonGroup.data('moved')) {
                    self.buttonGroup.appendTo('#navbar-right');
                    self.buttonGroup.data('moved', true);
                }
                if (res.orders && res.orders.length) {
                    var found = {};
                    for (var i = 0; i < res.orders.length; i++) {
                        var o = res.orders[i];
                        found[o.invoiceId] = 1;
                        if ($('#' + o.invoiceId).length) {
                            continue;
                        }
                        var li = $('<li/>', {id: o.invoiceId, class: 'order'});
                        var a = $('<a/>', {text: o.name || o.invoiceId});
                        li.append(a);
                        $('ul', self.buttonGroup).prepend(li);
                    }
                    $('#savedOrderCount').text(res.orders.length);
                    $('li.order', self.buttonGroup).each(function () {
                        if (!found[this.id]) {
                            $(this).remove();
                        }
                    });
                    self.buttonGroup.show();
                } else {
                    $('li.order', self.buttonGroup).remove();
                    self.buttonGroup.hide();
                }
            }
        });
    }
};

module.exports = SavedOrder;
