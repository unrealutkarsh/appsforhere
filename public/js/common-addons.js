if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        function F() {
        }

        F.prototype = o;
        return new F();
    };
}

function uploadSomething(url, formData, cb) {
    $('#progressAlert').attr('aria-hidden', 'true').css('display', 'none');
    $('#progressBar').css('width', 0).attr('aria-valuenow', 0);
    $('#progressModal').modal('show');
    formData.append('_csrf', _csrf);
    $.ajax({
        url: url,
        type: 'POST',
        xhr: function () {
            var myXhr = $.ajaxSettings.xhr();
            if (myXhr.upload) { /* Check if upload property exists */
                myXhr.upload.addEventListener('progress', function (e) {
                    $('#progressBar').css('width', parseInt(e.loaded * 100 / e.total)).attr('aria-valuenow', parseInt(e.loaded * 100 / e.total));
                }, false);
                /* For handling the progress of the upload */
            }
            return myXhr;
        },
        beforeSend: function () {
        },
        success: function (data) {
            $('#progressBar').css('width', 100).attr('aria-valuenow', 100);
            $('#progressModal').modal('hide');
            cb(null, data);
        },
        error: function (xhr, type, error) {
            $('#progressError').html(error);
            $('#progressAlert').css('display', 'block').alert();
            cb(error, type);
        },
        data: formData,
        cache: false,
        contentType: false,
        processData: false
    });

}


/*
 Fixup stacked modals
 */
$('.modal').on('hidden.bs.modal', function (event) {
    $(this).removeClass('fv-modal-stack');
    $('body').data('fv_open_modals', $('body').data('fv_open_modals') - 1);
});


$('.modal').on('shown.bs.modal', function (event) {
    /* keep track of the number of open modals */
    if (typeof( $('body').data('fv_open_modals') ) == 'undefined') {
        $('body').data('fv_open_modals', 0);
    }
    /* if the z-index of this modal has been set, ignore. */
    if ($(this).hasClass('fv-modal-stack')) {
        return;
    }
    $(this).addClass('fv-modal-stack');
    $('body').data('fv_open_modals', $('body').data('fv_open_modals') + 1);
    $(this).css('z-index', 1040 + (10 * $('body').data('fv_open_modals')));
    $('.modal-backdrop').not('.fv-modal-stack')
        .css('z-index', 1039 + (10 * $('body').data('fv_open_modals')));
    $('.modal-backdrop').not('fv-modal-stack')
        .addClass('fv-modal-stack');

});

(function ($) {
    if ($.fn.bootstrapValidator) {
        $.fn.bootstrapValidator.validators.selectized = {
            html5Attributes: {
                message: 'message',
                field: 'field',
                check_only_for: 'check_only_for'
            },
            validate: function (validator, $field, options) {
                var realInput = $field.parent().parent().parent().children('input.selectized');
                var rz = $.fn.bootstrapValidator.validators[options.validator].validate(validator, realInput, options);
                return rz;
            }
        }
    }

    $.fn.money_field = function (opts) {
        var defaults = { width: null, symbol: '$' };
        var opts = $.extend(defaults, opts);
        return this.each(function () {
            if (opts.width) {
                $(this).css('width', opts.width + 'px');
            }
            $(this).wrap("<div class='input-group'>").before("<span class='input-group-addon'>" + opts.symbol + "</span>");
        });
    };
}(window.jQuery));

function wireValidatedSelectize(id, bv) {
    $('#' + id + '_div input.selectized').on('change.update.bv', function () {
        var bvo = bv.data('bootstrapValidator');
        bvo.enableFieldValidators(id, true);
        bvo.validateField(id);
    });
}

var AjaxDataSource = function (urlOrUrlFn) {
    this.url = urlOrUrlFn;
};

AjaxDataSource.prototype = {

    /**
     * Returns stored column metadata
     */
    columns: function () {
        return this._columns;
    },

    _buildResponse: function (options, callback) {
        var data = this.sourceData, self = this;
        // Return data to Datagrid
        if (options.search) {
            data = _.filter(data, function (item) {
                var match = false;

                if (self.searchProperties) {
                    self.searchProperties.forEach(function (prop) {
                        console.log(prop,item.name,item[prop]);
                        if ((item[prop]||'').toString().toLowerCase().indexOf(options.search.toLowerCase()) !== -1) match = true;
                    });
                } else {
                    _.each(item, function (prop) {
                        if (_.isString(prop) || _.isFinite(prop)) {
                            if (prop.toString().toLowerCase().indexOf(options.search.toLowerCase()) !== -1) match = true;
                        }
                    });
                }

                return match;
            });
        }
        if (typeof(self.filter) === 'function') {
            data = self.filter(data, options);
        }

        data = data || [];
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
        if (this.formatter) {
            var self = this;
            $.each(data, function (index, item) {
                self.formatter(index, item);
            });
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
        if (this.sourceData) {
            this._buildResponse(options, callback);
        } else {
            var self = this;
            url = this.url;
            if (typeof(url) === 'function') {
                url = url(this, options);
            }
            $.ajax({
                url: url,
                success: function (data) {
                    self.success(data, options, callback);
                },
                error: function (xhr, type, error) {
                    self.error(error, callback);
                }
            });
        }
    },

    error: function (e, cb) {
        cb();
    }
};

function fdsupport() {
    window.FreshWidget.show();
}

function m$(x) {
    return accounting.formatMoney(x);
}