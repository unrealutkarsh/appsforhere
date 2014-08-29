var $delegateFeatureSelect, dataSource, selectedDelegate, fakePassword = '••••••••••••';

var allRoles = [
    {text: 'View Products', value: 'ViewProducts'},
    {text: 'Edit Products', value: 'EditProducts'},
    {text: 'View Sales Reports', value: 'ViewReports'},
    {text: 'View Locations', value: 'ViewLocations'},
    {text: 'Edit Locations', value: 'EditLocations'}
];

var DelegateDataSource = function (options) {

    this._columns = [
        {
            property: 'name',
            label: 'Name',
            sortable: true
        },
        {
            property: 'allowedString',
            label: 'Allowed Resources',
            sortable: false
        },
        {
            property: 'lastLogin',
            label: 'Last Login',
            sortable: true,
            width: 125
        }
    ];

    this._formatter = function (items) {
        $.each(items, function (index, item) {
            item.allowedString = item.allowed.map(function (a) {
                for (var i = 0; i < allRoles.length; i++) {
                    if (allRoles[i].value === a) {
                        return allRoles[i].text;
                    }
                }
                return a;
            }).join(', ');
        });
    }
};

DelegateDataSource.prototype = {

    /**
     * Returns stored column metadata
     */
    columns: function () {
        return this._columns;
    },

    _buildResponse: function (options, callback) {
        var data = this.rawData;
        // Return data to Datagrid
        if (options.search) {
            data = _.filter(data, function (item) {
                var match = false;

                _.each(item, function (prop) {
                    if (_.isString(prop) || _.isFinite(prop)) {
                        if (prop.toString().toLowerCase().indexOf(options.search.toLowerCase()) !== -1) match = true;
                    }
                });

                return match;
            });
        }

        var count = data.length;

        if (options.sortProperty) {
            data = _.sortBy(data, options.sortProperty);
            if (options.sortDirection === 'desc') {
                data.reverse();
            }
        }
        // PAGING
        var startIndex = options.pageIndex * options.pageSize;
        var endIndex = startIndex + options.pageSize;
        var end = (endIndex > count) ? count : endIndex;
        var pages = Math.ceil(count / options.pageSize);
        var page = options.pageIndex;
        var start = startIndex;

        data = data.slice(startIndex, endIndex);
        if (this._formatter) {
            this._formatter(data);
        }

        var resp = { items: data, start: start, end: end, count: count, pages: pages, page: page, columns: this._columns };
        callback(resp);
    },

    /**
     * Called when Datagrid needs data. Logic should check the options parameter
     * to determine what data to return, then return data by calling the callback.
     * @param {object} options Options selected in datagrid (ex: {pageIndex:0,pageSize:5,search:'searchterm'})
     * @param {function} callback To be called with the requested data.
     */
    data: function (options, callback) {
        if (this.rawData) {
            this._buildResponse(options, callback);
        } else {
            var self = this;
            $.ajax('/oauth/delegates?format=json', {
                dataType: 'json',
                type: 'GET'
            }).done(function (response) {
                model = response;
                self.rawData = response.delegates;
                self._buildResponse(options, callback);
            });
        }
    }
};

dataSource = new DelegateDataSource();

function showItem(d) {
    $('#delegateName').val(d.name);
    $('#delegatePassword').val(fakePassword);
    $delegateFeatureSelect[0].selectize.setValue(d.allowed);
    $('#delegateForm').data('bootstrapValidator').resetForm();
    $('#deleteDelegate').show();
    $('#delegateModal').modal();
}

function saveDelegate() {
    var needInsert = false;
    if (!selectedDelegate) {
        selectedDelegate = {};
        needInsert = true;
    }
    selectedDelegate.name = $('#delegateName').val();
    selectedDelegate.password = $('#delegatePassword').val();
    selectedDelegate.allowed = $delegateFeatureSelect[0].selectize.getValue().split(',');

    $('#progressAlert').attr('aria-hidden', 'true').css('display', 'none');
    $('#progressBar').css('width', 0).attr('aria-valuenow', 0);
    $('#progressModal').modal('show');

    selectedDelegate._csrf = _csrf;

    $.ajax({
        url: '/oauth/delegates',
        dataType: 'json',
        data: selectedDelegate,
        type: 'POST',
        cache: false,
        success: function (data) {
            if (!data || !data.success) {
                $('#progressError').html(data.message);
                $('#progressAlert').css('display', 'block').alert();
                $('#delegateForm').data('bootstrapValidator').resetForm();
            } else {
                $('#progressModal').modal('hide');
                setTimeout(function () {
                    $('#delegateModal').modal('hide');

                    if (needInsert) {
                        dataSource.rawData.unshift(selectedDelegate);
                    }
                    $('#delegateGrid').repeater('render');

                    $('#delegateUrl').val(data.url);
                    setTimeout(function () {
                        $('#delegationUrlModal').modal();
                        $('#delegateUrl').focus();
                    }, 500);
                }, 500);
            }
        },
        error: function (xhr, type, error) {
            $('#progressError').html(error);
            $('#progressAlert').css('display', 'block').alert();
            $('#delegateForm').data('bootstrapValidator').resetForm();
        }
    });
}

$(document).ready(function () {
    $('#delegateGrid').repeater({
        dataSource: function (o, c) {
            dataSource.data(o, c);
        },
        defaultView: 'list',
        list_selectable: true,
        list_noItemsHTML: '<i>Delegation allows you to share a working link to various features on this site without sharing your actual PayPal login information.<br/><br/>You may delete or change the password of previous delegations at any time.</i>'
    });

    $('#delegateGrid').on('click', 'table>tbody>tr', function () {
        var $this = $(this);
        // Undo selection UI
        $this.removeClass('selected');
        $this.find('.repeater-list-check').remove();
        selectedDelegate = $(this).data("item_data");
        showItem(selectedDelegate);
    });

    $('#delegatePassword').on('click focusin', function() {
        if (this.value === fakePassword) {
            this.value = '';
        }
    });

    $('#delegatePassword').on('focusout', function () {
        if (this.value.length === 0 && selectedDelegate.id) {
            this.value = fakePassword;
        }
    })

    $('#addDelegate').on('click', function () {
        selectedDelegate = null;
        $('#deleteDelegate').hide();
        $('#delegateName').val("");
        $('#delegatePassword').val("");
        $('#delegateModal').modal();
    });

    $('#deleteDelegate').on('click', function () {
        $('#progressAlert').attr('aria-hidden', 'true').css('display', 'none');
        $('#progressBar').css('width', 0).attr('aria-valuenow', 0);
        $('#progressModal').modal('show');

        $.ajax({
            url: '/oauth/delegates/'+selectedDelegate.id,
            dataType: 'json',
            type: 'DELETE',
            cache: false,
            data: {_csrf:_csrf},
            success: function (data) {
                if (!data || !data.success) {
                    $('#progressError').html(data.message);
                    $('#progressAlert').css('display', 'block').alert();
                    $('#delegateForm').data('bootstrapValidator').resetForm();
                } else {
                    $('#progressModal').modal('hide');
                    $('#delegateModal').modal('hide');

                    dataSource.rawData.splice($.inArray(selectedDelegate, dataSource.rawData), 1);
                    selectedDelegate = null;
                    $('#delegateGrid').repeater('render');
                }
            },
            error: function (xhr, type, error) {
                $('#progressError').html(error);
                $('#progressAlert').css('display', 'block').alert();
                $('#delegateForm').data('bootstrapValidator').resetForm();
            }
        });
    });

    $delegateFeatureSelect = $('#delegateFeatures').selectize({
        delimiter: ',',
        persist: false,
        create: false,
        options: allRoles,
        openOnFocus: true,
        plugins: ['remove_button']
    });

    $('#delegateFeatures_div div.selectize-input').addClass('form-control');

    var bv = $('#delegateForm').bootstrapValidator({
        live: 'enabled',
        excluded: [],
        submitHandler: saveDelegate,
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            delegateName: {
                validators: {
                    notEmpty: {
                        message: 'A name is required.'
                    }
                }
            },
            delegatePassword: {
                validators: {
                    notEmpty: {
                        message: 'A password is required.'
                    }
                }
            },
            delegateFeatures: {
                selector: '#delegateFeatures_div div.selectize-input input',
                validators: {
                    selectized: {
                        validator: 'notEmpty',
                        message: 'You must grant access to at least one feature.'
                    }
                }
            }
        }
    });
    wireValidatedSelectize('delegateFeatures', bv);
});
