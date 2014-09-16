
function addr(item) {
    return item.address.line1 + ', ' + item.address.city + ', ' + item.address.state;
}

$(document).ready(function () {
    var builtInButtons = [
        {
            label: 'Bid',
            value: 'BID'
        },
        {
            label: 'Donate',
            value: 'DONATE'
        },
        {
            label: 'Order',
            value: 'ORDER'
        },
        {
            label: 'Schedule',
            value: 'SCHEDULE'
        },
        {
            label: 'View Bill',
            value: 'VIEWBILL'
        }
    ];

    var btn = $('#locationSaveButton');
    if (btn) {
        $('#buttonName').selectize({
            create: function (v) {
                return {
                    label: v,
                    value: v
                };
            },
            createOnBlur: true,
            maxItems: 1,
            options: builtInButtons,
            labelField: 'label',
            valueField: 'value',
            searchField: ['label']
        });

        $('#locationSaveButton').on('click', function (e) {
            e.preventDefault();
            var lid = $('#locationId').val();
            var url = $('#appLink').attr('href');
            var btn = $('#buttonName').val();
            if ((!lid || lid.length == 0) ||
                (!btn || btn.length == 0)) {
                alert('Please choose a location and enter a button name.');
                return;
            }
            var l = Ladda.create(this);
            l.start();
            $.ajax({
                dataType: 'json',
                data: { button: btn, url: url, type: 'postOpen', _csrf: _csrf },
                url: '/locations/'+lid+'/app',
                type: 'POST',
                cache: false,
                success: function (data) {
                    l.stop();
                },
                error: function (xhr, type, error) {
                    l.stop();
                    alert(error);
                }
            });
        });

        $('#locationId').selectize({
            valueField: 'id',
            labelField: 'name',
            searchField: 'name',
            preload: true,
            create: false,
            maxItems: 1,
            render: {
                option: function(item, escape) {
                    return '<div>' +
                        '<img src="'+escape(item.logoUrl)+'" width="80" height="80" class="pull-left"/>' +
                        '<div class="name"><b>' + escape(item.name) + '</b></div>' +
                        '<span class="description">' + escape(addr(item)) + '</span>' +
                        '</div>';
                }
            },
            load: function(query, callback) {
                if (this._locations) {
                    callback(this._locations);
                    return;
                }
                this._locations = {};
                $.ajax({
                    url: '/locations/api',
                    type: 'GET',
                    error: function() {
                        callback();
                    },
                    success: function(res) {
                        this._locations = res.locations;
                        callback(res.locations);
                    }
                });
            }
        });
    }
});