var selectedModel = '_', categoryFilter, filterAny = true, inv = new Invoice('USD'), model;
var editingItem, paymentTypeView, paymentRequest, coords, tabs;
var locationSelectize, categorySelectize, locations;

var CheckinDataSource = function () {
    var cols = [
        {
            property: 'imageTag',
            className: 'pph-itemPhoto',
            width: 30
        },
        {
            property: 'customerName'
        }
    ];
    this.data = function (opt, cb) {
        var t = tabs || [];
        for (var i = 0; i < t.length; i++) {
            t[i].imageTag = "<img src=\"" + t[i].photoUrl.replace("\"", "") +
            "\" width=\"40\" height=\"40\"/>";
            t[i].src = t[i].photoUrl;
            t[i].name = t[i].customerName;
        }
        var r = { items: t, start: 0, end: t.length, count: t.length, pages: 1, page: 1, columns: cols };
        cb(r);
    };
};

var CartDataSource = function () {
    var cols = [
        {
            width: 10,
            className: 'pph-spacer'
        },
        {
            property: 'imageTag',
            className: 'pph-itemPhoto',
            width: 30
        },
        {
            property: 'nameDesc'
        },
        {
            property: 'qtyPrice',
            className: 'amt'
        },
        {
            width: 10
        }
    ];
    this.data = function (opt,cb) {
        var data = [];
        data.push({special:'add',imageTag:'<img src="/media/image_default_138.png" height="40" width="40"/>',nameDesc:'New item...',qtyPrice:accounting.formatMoney(0)});
        inv.items.forEach(function (i) {

            var qtyPrice = '<div style="float:right;">' + accounting.formatMoney(i.totalForInvoice(inv).toString()) + '</div>';
            qtyPrice += '<span class="badge">' + i.quantity + '</span>';
            data.push({
                item: i,
                nameDesc: i.name,
                qtyPrice: qtyPrice,
                imageTag: "<img src=\"" +
                (i.photoUrl || '/media/image_default_138.png').replace("\"", "") +
                "\" width=\"40\" height=\"40\"/>"
            });
        });
        var tots = inv.calculate();
        data.push({special:'discount',imageTag:'<img src="/media/ic_sale_discount.png" height="40" width="40"/>',nameDesc:'Discount',qtyPrice:accounting.formatMoney('0')});
        data.push({special:'tax',imageTag:'<img src="/media/ic_sale_percentage.png" height="40" width="40"/>',nameDesc:'Tax',qtyPrice:accounting.formatMoney((tots.itemTax||0).toString())});
        var r = { items: data, start: 0, end: data.length, count: data.length, pages: 1, page: 1, columns: cols };
        if (tots.total.toString() === '0') {
            $('#charge').prop('disabled', true);
        } else {
            $('#charge').prop('disabled', false);
        }
        $('#chargeBtnAmount').text(m$(tots.total.toString()));
        cb(r);
    }
};

var ProductDataSource = function (options) {
    AjaxDataSource.call(this, function () {
        return '/products/api/model/' + selectedModel + '?format=json';
    });
    this.searchProperties = ['name','displayTags','description'];
    this._columns = [
        {
            property: 'imageTag',
            label: '<div class="glyphicon glyphicon-camera"></div>',
            sortable: false,
            className: 'pph-itemPhoto',
            width: 60
        },
        {
            property: 'name',
            label: 'Name',
            sortable: true
        },
        {
            property: 'displayPrice',
            label: 'Price',
            sortable: true,
            className: 'text-right',
            width: 175
        }
    ];

};

ProductDataSource.prototype = Object.create(AjaxDataSource.prototype);
ProductDataSource.prototype.constructor = ProductDataSource;
ProductDataSource.prototype.success = function (data, options, callback) {
    this.sourceData = data.products;
    model = data;
    categoryFilter[0].selectize.load(function (cb) {
        cb(data.tags);
    });
    catalogSelectize[0].selectize.load(function (cb) {
        cb(data._savedModels);
        for (var i = 0; i < data._savedModels.length; i++) {
            if (data._savedModels[i].id == selectedModel) {
                catalogSelectize[0].selectize.setValue(data._savedModels[i].id);
            }
        }
    });
    this._buildResponse(options, callback);
};
ProductDataSource.prototype.filter = function (data, options) {
    if (!categoryFilter) {
        return data;
    }
    var catval = categoryFilter[0].selectize.items;
    if (!catval||catval.length===0) {
        return data;
    }
    data = _.filter(data, function (item) {
        for (var i = 0; i < catval.length; i++) {
            if (item.tags && item.tags.indexOf(catval[i]) >= 0) {
                if (filterAny) {
                    return true;
                }
            } else if (!filterAny) {
                return false;
            }
        }
        return filterAny ? false : true;
    });
    return data;
};
ProductDataSource.prototype.formatter = function (index, item) {
    item.displayPrice = accounting.formatMoney(item.price);
    if (item.variations && item.variations.length) {
        item.variationCount = item.variations.length;
        var minPrice = new BigNumber(item.variations[0].price), maxPrice = minPrice;
        for (var i = 0; i < item.variationCount; i++) {
            var vPrice = item.variations[i].price;
            if (!vPrice) {
                continue;
            }
            vPrice = new BigNumber(vPrice);
            if (vPrice.gt(maxPrice)) {
                maxPrice = vPrice;
            } else if (vPrice.lt(minPrice)) {
                minPrice = vPrice;
            }
        }
        minPrice = accounting.formatMoney(minPrice);
        maxPrice = accounting.formatMoney(maxPrice);
        if (maxPrice !== minPrice) {
            item.displayPrice = minPrice + ' - ' + maxPrice;
        }
    } else if (item.variationCount) {
        delete item.variationCount;
    }
    // TODO not sure this is sufficient escaping even though it's coming from our server.
    item.imageTag = "<img src=\"" +
        (item.photoUrl || '/media/image_default_138.png').replace("\"", "") +
        "\" width=\"60\" height=\"60\"/>";
    if (item.tags) {
        item.displayTags = item.tags.join(', ');
    }
};

dataSource = new ProductDataSource();

$(function () {
    $('#pleaseWaitDialog').modal();
    realInit();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(haveLocation, locationError);
    } else {
        locationError();
    }
});

function haveLocation(position) {
    coords = position.coords;
    $('#pleaseWaitDialog').modal('hide');
}

function locationError() {
    alert('Your location is required to use this application.');
}

function realInit() {
    $('#productGrid').repeater({
        dataSource: function (o, c) {
            dataSource.data(o, c);
        },
        defaultView: 'list',
        list_selectable: true
    });
    $('#productGrid').on('click', 'table>tbody>tr', function () {
        var $this = $(this);
        // Undo selection UI
        $this.removeClass('selected');
        $this.find('.repeater-list-check').remove();
        var product = $(this).data("item_data");
        if ((product.variations && product.variations.length)||(product.options && product.options.length)) {
            $('#optionModal').modal();
            return;
        }
        var item = new Invoice.Item(1, product.price, product.id);
        item.name = product.name;
        if (product.taxRateName && model.taxRates) {
            model.taxRates.forEach(function (t) {
                if (product.taxRateName == t.name) {
                    item.taxRate = Invoice.Number(t.rate).times(100);
                    item.taxName = t.name;
                }
            });
        }
        item.photoUrl = product.photoUrl;
        item._product = product;
        inv.addItem(item);
        $('#cartGrid').repeater('render');
    });
    $('#cartGrid').on('click', 'div.repeater-list-wrapper>table >tbody>tr', function () {
        var $this = $(this);
        editingItem = $this.data("item_data");
        // Undo selection UI
        $this.removeClass('selected');
        $this.find('.repeater-list-check').remove();
        if (editingItem && editingItem.special === 'tax') {

        } else if (editingItem && editingItem.special === 'discount') {
        } else if (editingItem && editingItem.special === 'add') {
            editingItem = null;
            $('#cartItemName').val('');
            $('#cartQty').val(1);
            $('#cartItemPrice').val('');
            $('#cartItemModal').modal();
        } else {
            $('#cartItemName').val(editingItem.item.name);
            $('#cartQty').val(editingItem.item.quantity.toString());
            $('#cartItemPrice').val(editingItem.item.unitPrice.toString());
            $('#cartItemModal').modal();
        }
    });

    $('#cartItemModal').on('shown.bs.modal', function () {
        if (editingItem && !editingItem.special) {
            $('#cartQty').focus();
        } else {
            $('#cartItemName').focus();
        }
    });

    $('#cartQty').on('keypress', function (e) {
        if (e.charCode === 32) {
            e.preventDefault();
            var inc = Invoice.Number($('#cartQty').val()).plus(1);
            $('#cartQty').val(inc.toString());
        }
    });
    $('#cartQty').zeninput({});
    $('#cartItemPrice').zeninput({});

    $('#saveCartItem').on('click', function (e) {
        if (editingItem) {
            editingItem.item.quantity = Invoice.Number($('#cartQty').val());
            editingItem.item.unitPrice = Invoice.Number($('#cartItemPrice').val());
        } else {
            var item = new Invoice.Item($('#cartQty').val(), $('#cartItemPrice').val(), new Date().getTime());
            item.name = $('#cartItemName').val();
            inv.addItem(item);
        }
        e.preventDefault();
        $('#cartGrid').repeater('render');
        $('#cartItemModal').modal('hide');
    });

    $('#removeCartItem').on('click', function (e) {
        var ix = $.inArray(editingItem.item, inv.items);
        inv.items.splice(ix, 1);
        $('#cartGrid').repeater('render');
        $('#cartItemModal').modal('hide');
    });

    var cartDS = new CartDataSource();
    $('#cartGrid').repeater({
        dataSource: cartDS.data,
        defaultView: 'list',
        list_selectable: true,
        list_rowRendered: function (helpers, callback) {
            if (helpers.rowData.special) {
                helpers.item.addClass('special-'+helpers.rowData.special);
            }
            callback();
        }
    });

    var ciDS = new CheckinDataSource();
    $('#checkinGrid').repeater({
        dataSource: ciDS.data,
        thumbnail_selectable: true,
        defaultView: 'thumbnail',
        list_selectable: true,
        list_noItemsHTML: '<h1>No customers are checked in.</h1>',
        thumbnail_noItemsHTML: '<h1>No customers are checked in.</h1>'
    });
    $('#checkinGrid2').repeater({
        dataSource: ciDS.data,
        thumbnail_selectable: true,
        defaultView: 'thumbnail',
        list_selectable: true,
        list_noItemsHTML: '<h1>No customers are checked in.</h1>',
        thumbnail_noItemsHTML: '<h1>No customers are checked in.</h1>'
    });

    var rep = $('#productGrid').data('fu.repeater');
    rep.$search.on('keyup.fu.search', $.proxy(rep.render, rep, { clearInfinite: true, pageIncrement: null }));;

    categoryFilter = $("#categories").selectize({
        delimiter: ',',
        persist: false,
        openOnFocus: true,
        hideSelected: true,
        valueField: 'name',
        labelField: 'name',
        searchField: ['name'],
        plugins: ['remove_button'],
        create: false
    });

    categoryFilter[0].selectize.on('change', function () {
        $('#productGrid').repeater('render');
    });

    locationSelectize = $('#location').selectize({
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
                    locations = res.locations;
                    if (s.getValue().length == 0 && res.locations && res.locations.length > 0) {
                        s.setValue(res.locations[0].id);
                        pollTabs();
                    }
                }
            });
        }
    });

    locationSelectize[0].selectize.on('change', function () {
        pollOnce();
    });

    catalogSelectize = $('#catalog').selectize({
        maxItems: 1,
        persist: false,
        openOnFocus: true,
        valueField: 'id',
        labelField: 'name',
        searchField: ['name'],
        create: false
    });
    catalogSelectize.on('change', function () {
        var newModel = $(this).val();
        if (newModel !== selectedModel) {
            selectedModel = newModel;
            delete dataSource.sourceData;
            $('#productGrid').repeater('render');
        }
    });

    var eventCounter = 0;
    $('#paymentTypeModal').on('shown.bs.modal', function () {
       $('#keyboardWatcher').focus();
    }).on('hidden.bs.modal', function () {
        eventCounter = 0;
    });

    var paycodeRegEx = /PPPAY\*ACC\:([0-9]+)\*DT\:([0-9]+)/i;
    function checkKeyboard() {
        var v = $(this).val();
        try {
            var idtech = decodeIdTech(v);
            swipeDetected(idtech);
            return;
        } catch (x) {
            // Not idTech
        }
        var match = v.match(paycodeRegEx);
        if (match) {
            paycodeDetected(match[1]);
            return;
        }
    }

    $('#keyboardWatcher').on('keyup', checkKeyboard).on('change', checkKeyboard)
        .on('blur', function () {
            var myEvent = ++eventCounter;
            setTimeout(function () {
                if (eventCounter == myEvent) {
                    $('#keyboardHasFocus').hide();
                    $('#keyboardNeedsFocus').show();
                }
            }, eventCounter == 1 ? 0 : 50);
        }).on('focus', function () {
            var myEvent = ++eventCounter;
            this.value = '';
            setTimeout(function () {
                if (eventCounter == myEvent) {
                    $('#keyboardHasFocus').show();
                    $('#keyboardNeedsFocus').hide();
                }
            }, 50);
        });

    $('#keyboardGetFocus').on('click', function (e) {
        e.preventDefault();
        $('#keyboardWatcher').focus();
    });

    $('#charge').on('click', function () {
        var tots = inv.calculate();
        if (tots.total.toString() === '0') {
            return;
        }
        if (!paymentTypeView) {
            paymentTypeView = $('#noEntry');
            paymentTypeView.show();
        }
        $('#paymentTypeModal').modal();
    });

    $('#cashTendered').money_field({});
    $('#cashChange').money_field({});
    $('#cashTendered').on('keyup', function (e) {
        var amt = Invoice.Number($(this).val()).minus(inv.calculate().total);
        $('#cashChange').val(amt.greaterThan(0) ? amt : '');
    });
    $('#doCashPayment').on('click', function (e) {
        e.preventDefault();
        var tender = $('#cashTendered').val();
        if (tender && tender.length) {
            inv.receiptDetails = inv.receiptDetails || {};
            inv.receiptDetails.payment = inv.receiptDetails.payment || {};
            inv.receiptDetails.payment.tendered = tender;
        }
        paymentRequest = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            paymentType: 'cash',
            invoice: deepFreeze(inv)
        };
        addMerchantInfo(paymentRequest.invoice);
        sendPaymentRequest(this, $('#paymentTypeModal'));
    });
    $('#doCheckPayment').on('click', function (e) {
        e.preventDefault();
        var num = $('#checkNumber').val();
        var name = $('#checkName').val();
        var ph = $('#checkPhone').val();
        if ((num && num.length) || (name && name.length) || (ph && ph.length)) {
            inv.receiptDetails = inv.receiptDetails || {};
            inv.receiptDetails.payment = inv.receiptDetails.payment || {};
            inv.receiptDetails.payment.check = {num:num,name:name,phone:ph};
        }
        paymentRequest = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            paymentType: 'check',
            invoice: deepFreeze(inv)
        };
        addMerchantInfo(paymentRequest.invoice);
        sendPaymentRequest(this, $('#paymentTypeModal'));
    });

    $('#paymentTypeSelector').on('click', 'button', function () {
        var newView = $('#'+$(this).data('value'));
        if (paymentTypeView && paymentTypeView != newView) {
            paymentTypeView.hide();
        }
        paymentTypeView = newView;
        paymentTypeView.show();
        var f = $('input[data-autofocus="1"]', paymentTypeView);
        if (f && f.length) {
            f.focus();
        } else {
            $('#keyboardWatcher').focus();
        }
    });

    $('#doPayment').on('click', function () {
        sendPaymentRequest(this, $('#paymentConfirmModal'));
    });

    function sendPaymentRequest(button,fromModal) {
        var l = Ladda.create(button);
        l.start();
        $.ajax({
            dataType: 'json',
            data: {payload: paymentRequest, _csrf: _csrf},
            url: '/sell',
            type: 'POST',
            cache: false,
            success: function (data) {
                l.stop();
                inv.payPalId = data.invoiceId;
                inv.transactionId = data.transactionId;
                fromModal.modal('hide');
                $('#paymentCompleteModal').modal();
            },
            error: function (xhr, type, error) {
                l.stop();
                if (xhr.responseJSON && xhr.responseJSON.developerMessage) {
                    alert(xhr.responseJSON.developerMessage);
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    alert(xhr.responseJSON.message);
                } else {
                    alert(error);
                }
            }
        });
    }

    $('#paymentCompleteModal').on('shown.bs.modal', function (e) {
        $("#receiptDestination").focus();
    });

    $('#receiptDestination').on('keyup', function (e) {
       var v = $(this).val(), tx, showDisclaimer = false;
        if (v.match(/[^0-9\-\(\) ]+/)) {
            tx = '@';
        } else if (v.match(/^[0-9 \-\(\)]+$/)) {
            tx = '#';
            showDisclaimer = true;
        } else {
            tx = '@ | #';
        }
        $('#smsDisclaimer').toggle(showDisclaimer);
        $('#receiptType').text(tx);
    });

    $('#sendReceiptButton').on('click', function (e) {
        e.preventDefault();
        var data = { invoiceId: inv.payPalId, _csrf: _csrf };
        var rd = $('#receiptDestination'), v = rd.val();
        if (v.indexOf('@') > 0) {
            data.email = v;
        } else {
            data.phoneNumber = v;
        }
        var l = Ladda.create(this);
        l.start();
        $.ajax({
            dataType: 'json',
            data: data,
            url: '/sell/receipt',
            type: 'POST',
            cache: false,
            success: function (data) {
                l.stop();
                if (rd.attr('placeholder') != rd.data('sentplaceholder')) {
                    rd.data('originalph', rd.attr('placeholder'));
                    rd.attr('placeholder', rd.data('sentplaceholder'));
                }
                rd.attr('placeholder','Receipt sent');
                rd.val('');
            },
            error: function (xhr, type, error) {
                l.stop();
                if (xhr.responseJSON && xhr.responseJSON.developerMessage) {
                    alert(xhr.responseJSON.developerMessage);
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    alert(xhr.responseJSON.message);
                } else {
                    alert(error);
                }
            }
        });
    });

    $('#newOrder').on('click', function () {
        inv = new Invoice('USD');
        var rd = $('#receiptDestination');
        rd.val('');
        if (rd.data('originalph')) {
            rd.attr('placeholder', rd.data('originalph'));
        }
        $('#receiptType').text('@ | #');
        $('#smsDisclaimer').hide();
        i
        $('#cartGrid').repeater('render');
        $('#charge').prop('disabled', true);
        $('#chargeBtnAmount').text(m$("0"));
        $('#paymentCompleteModal').modal('hide');
    });

    $('#customerInfo').on('click', 'td.user', function (e) {
        $('#checkinGrid').repeater('render');
        $('#checkinModal').modal();
    });

    $('#customerInfo').on('click', 'td.info', function (e) {
        if (inv.payerEmail && inv.payerEmail !== 'noreply@here.paypal.com') {
            $('#customerEmail').val(inv.payerEmail);
        }
        var l = getCurrentLocation();
        if (l && l.address) {
            $('#customerCountry').val(l.address.country);
        }
        if (inv.billingInfo) {
            $('#customerFirstName').val(inv.billingInfo.firstName);
            $('#customerLastName').val(inv.billingInfo.lastName);
            $('#customerBizName').val(inv.billingInfo.businessName);
            $('#customerPhone').val(inv.billingInfo.phoneNumber);
            var a = inv.billingInfo.address;
            if (a) {
                $('#customerAddress1').val(a.line1);
                $('#customerAddress2').val(a.line2);
                $('#customerCity').val(a.city);
                $('#customerState').val(a.state);
                $('#customerPostal').val(a.postalCode);
                $('#customerCountry').val(a.country);
            }
        }
        $('#customerInfoModal').modal();
    });

    $('#customerInfoForm').bootstrapValidator({
        live: 'enabled',
        trigger: 'blur',
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            customerEmail: {
                validators: {
                    emailAddress: {
                        message: 'Please enter a valid email address.'
                    }
                }
            }
        }
    });

    function neVal(selector) {
        var x = $(selector).val();
        if (x && x.length > 0) {
            return x;
        }
        return null;
    }
    $('#saveCustomerInfo').on('click', function (e) {
        e.preventDefault();
        $('#customerInfoModal').modal('hide');
        inv.payerEmail = $('#customerEmail').val();
        var fn = neVal('#customerFirstName'), ln = neVal('#customerLastName'), bz = neVal('#customerBizName');
        var a1 = neVal('#customerAddress1'), a2 = neVal('#customerAddress2'), ph = neVal('#customerPhone');
        var c = neVal('#customerCity'), s = neVal('#customerState'), z = neVal('#customerPostal'), ct = neVal('#customerCountry');
        if (fn || ln || bz || a1 || a2 || c || s || z || ph) {
            var bi = inv.billingInfo;
            if (!bi) {
                bi = inv.billingInfo = {};
            }
            bi.firstName = fn;
            bi.lastName = ln;
            bi.businessName = bz;
            bi.phoneNumber = ph;
            if (a1 || a2 || c || s || z) {
                if (!bi.address) { bi.address = {}; }
                bi.address.line1 = a1;
                bi.address.line2 = a2;
                bi.address.city = c;
                bi.address.state = s;
                bi.address.postalCode = z;
                bi.address.country = ct;
            }
        } else {
            delete inv.billingInfo;
        }
        updateCartCustomerInfo();
    });

    updateCartCustomerInfo();
    setupCardEntry();
}

function personalName(bi) {
    if (!bi) { return null; }
    var ret = "";
    if (bi.firstName) {
        ret = bi.firstName;
        if (bi.lastName) {
            ret += " ";
        }
    }
    if (bi.lastName) {
        ret += bi.lastName;
    }
    return ret.length > 0 ? ret : null;
}

function addr(info) {
    if (!info) { return null; }
    var ret = "";
    if (info.line1) {
        ret = info.line1;
    }
    if (info.line2) {
        ret += "<br/>" + info.line2;
    }
    if (info.city || info.state || info.postalCode) {
        ret += "<br/>";
        if (info.city) {
            ret += info.city;
            if (info.state) {
                ret += ',';
            }
            if (info.state || info.postalCode) {
                ret += ' ';
            }
            if (info.state) {
                ret += info.state;
                if (info.postalCode) {
                    ret += ' ';
                }
            }
            if (info.postalCode) {
                ret += info.postalCode;
            }
        }
    }
    return ret.length > 0 ? ret : null;
}

function updateCartCustomerInfo() {
    var name, address, email, phone;
    if (inv.billingInfo) {
        name = inv.billingInfo.businessName || personalName(inv.billingInfo);
        address = addr(inv.billingInfo.address);
        phone = inv.billingInfo.phoneNumber;
    }
    email = inv.payerEmail;
    if (inv.payerEmail === 'noreply@here.paypal.com') {
        email = null;
    }
    $('#curCustomerName').toggleClass('placeholder', !name);
    $('#curCustomerEmail').toggleClass('placeholder', !email);
    $('#curCustomerName').text(name||'Customer Name');
    $('#curCustomerEmail').text(email||'someone@somewhere.com');
    $('#curCustomerAddress').html(address);
    $('#curCustomerPhone').text(phone);
}

function swipeDetected(data) {
    paymentRequest = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        paymentType: 'card',
        card: {
            reader: {
                vendor: "IDTECH",
                keySerialNumber: data.ksn,
                readerSerialNumber: data.serial
            },
            track1: data.track1,
            track2: data.track2,
            inputType: 'swipe'
        },
        invoice: deepFreeze(inv)
    };
    addMerchantInfo(paymentRequest.invoice);
    if (data.track1Masked) {
        var re = /^%([A-Z\*])([0-9\*]{1,19})\^([^\^]{2,26})\^([0-9\*]{4}|\^)([0-9\*]{3}|\^)([^\?]+)\?\*?$/;
        var m = data.track1Masked.match(re);
        if (m) {
            var card = m[2];
            if (card && card.length > 4) {
                card = card.substring(card.length - 4);
            }
            showConfirm('the card ending in ' + card);
        }
    } else if (data.track2Masked) {
        var re = /^;([0-9\*]{1,19})=([^\?]+)\?\*?$/;
        var m = data.track2Masked.match(re);
        if (m) {
            var card = m[1];
            if (card && card.length > 4) {
                card = card.substring(card.length - 4);
            }
            showConfirm('the card ending in ' + card);
        }
    }
}

function paycodeDetected(data) {
    paymentRequest = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        paymentType: 'payCode',
        payCode: data,
        // Deep freeze the invoice.
        invoice: deepFreeze(inv)
    };
    addMerchantInfo(paymentRequest.invoice);
    showConfirm('PayPal');
}

function showConfirm(summary) {
    $('#keyboardWatcher').val('');
    $('#paymentTypeModal').modal('hide');
    var tots = inv.calculate();
    $('#confirmAmount').text(m$(tots.total.toString()));
    $('#summary').text(summary);
    $('#paymentConfirmModal').modal();
}

function getCurrentLocation() {
    var l = locationSelectize[0].selectize.getValue();
    for (var i = 0; i < locations.length; i++) {
        var loc = locations[i];
        if (loc.id === l) {
            return loc;
        }
    }
    return null;
}

function addMerchantInfo(inv) {
    var loc = getCurrentLocation();
    if (loc) {
        inv.merchantInfo = inv.merchantInfo || {};
        inv.merchantInfo.address = loc.address;
        inv.merchantInfo.businessName = loc.name;
        if (!inv.logoUrl && loc.logoUrl) {
            inv.logoUrl = loc.logoUrl;
        }
    }
}

function setupCardEntry() {
    var validateDetails = function() {
        $('.cc-num').payment('formatCardNumber');
        $('.cc-exp').payment('formatCardExpiry');
        $('.cc-cvc').payment('formatCardCVC');
    }
    // this runs the above function every time stuff is entered into the card inputs
    $('.paymentInput').bind('change paste keyup', function() {
        validateDetails();
        $('.cc-type').val($.payment.cardType($('.cc-num').val()))
    });
    $('#newCardButton').on('click', function () {
        $('#result').hide();
        $('#newCard').show();
    });

    $('#credit-card-form').bootstrapValidator({
        live: 'enabled',
        trigger: 'blur',
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            'card-cvc': {
                validators: {
                    cvv: {
                        creditCardField: 'card-number',
                        message: 'The CVV number is not valid.'
                    }
                }
            }
        }
    });
}

function decodeIdTech(raw) {
    validateIdTech(raw);
    var cardData = raw.substring(6, raw.length - 6), parsed = {}, info = {};

    var format = getHexValue(cardData, 0);
    if (format & 0x80 !== 0x80) {
        throw new Error('Unknown card data format byte ' + cardData.substring(0, 2));
    }
    parsed.format = 'ISO/ABA';
    readMaskedIdTech(parsed, info, cardData);
    readIdTechSettings(parsed, cardData);
    readEncryptedIdTech(parsed, info, cardData);
    readSerialIdTech(parsed, info, cardData);

    return parsed;
}

function getHexValue(bufString, spot) {
    return parseInt(bufString.substring(spot, spot + 2), 16);
}

function isBitSet(val, bits) {
    return (val & bits) ? true : false;
}

function stringFromHex(bufString) {
    return new Buffer(bufString, 'hex').toString('ascii');
}

function validateIdTech(raw) {
    if (getHexValue(raw, 0) !== 2 || getHexValue(raw, raw.length - 2) !== 3) {
        throw new Error('Invalid raw track data. Missing start and end sentinel.');
    }
    var tkLen = getHexValue(raw, 2) + (getHexValue(raw, 4) << 8);
    if (raw.length !== tkLen + 12) {
        throw new Error('Raw track data length mismatch. Expected ' + (tkLen + 12) + ' got ' + raw.length);
    }
    validateIdTechChecksums(raw);
}

function validateIdTechChecksums(raw) {
    var ckSum = 0, ckXor = 0;
    for (var i = 6; i < raw.length - 6; i++) {
        ckXor ^= raw.charCodeAt(i);
        ckSum += raw.charCodeAt(i);
    }
    if (ckXor !== getHexValue(raw, raw.length - 6)) {
        throw new Error('Card Data XOR hash mismatch.');
    }
    if (ckSum % 256 !== getHexValue(raw, raw.length - 4)) {
        throw new Error('Card Data SUM hash mismatch.');
    }
}

function readIdTechSettings(parsed, cardData) {
    var field8 = getHexValue(cardData, 10);
    if (field8 & 0x8) {
        throw new Error('Card data is not encrypted with DUKPT - not supported.');
    }
    parsed.hasSessionId = (field8 & 0x40) ? true : false;
    parsed.hasKsn = (field8 & 0x80) ? true : false;
    parsed.encrypted = (field8 & 0x30) === 0 ? 'TDES' : 'AES';
    parsed.key = (field8 & 0x40) ? 'pin' : 'data';
}

function readMaskedIdTech(parsed, info, cardData) {
    checkForMaskedIdTechTracks(parsed, info, cardData);
    if (info.t1len) {
        parsed.track1Masked = cardData.substring(14, 14 + info.t1len);
    }
    if (info.t2len) {
        parsed.track2Masked = cardData.substring(14 + info.t1len, 14 + info.t1len + info.t2len);
    }
    if (info.t3len) {
        parsed.track3Masked = cardData.substring(14 + info.t1len + info.t2len, 14 + info.t1len + info.t2len + info.t3len);
    }
}

function checkForMaskedIdTechTracks(parsed, info, cardData) {
    var trackInfo = getHexValue(cardData, 2);
    parsed.hasTrack1Masked = (trackInfo & 0x1) ? true : false;
    parsed.hasTrack2Masked = (trackInfo & 0x2) ? true : false;
    parsed.hasTrack3Masked = (trackInfo & 0x4) ? true : false;

    info.t1len = getHexValue(cardData, 4);
    info.t2len = getHexValue(cardData, 6);
    info.t3len = getHexValue(cardData, 8);
}

function readEncryptedIdTech(parsed, info, cardData) {
    checkForEncryptedIdTechTracks(parsed, info, cardData);
    info.encStart = 14 + info.t1len + info.t2len + info.t3len;
    info.enct1 = Math.ceil(info.t1len / 8.0) * 16;
    info.enct2 = Math.ceil(info.t2len / 8.0) * 16;
    info.enct3 = Math.ceil(info.t3len / 8.0) * 16;

    if (info.enct1) {
        parsed.track1 = cardData.substring(info.encStart, info.encStart + info.enct1);
    }
    if (info.enct2) {
        parsed.track2 = cardData.substring(info.encStart + info.enct1, info.encStart + info.enct1 + info.enct2);
    }
    if (info.enct3) {
        parsed.track3 = cardData.substring(info.encStart + info.enct1 + info.enct2, info.encStart + info.enct1 + info.enct2 + info.enct3);
    }
}

function checkForEncryptedIdTechTracks(parsed, info, cardData) {
    var field9 = getHexValue(cardData, 12);
    parsed.hasTrack1 = isBitSet(field9, 0x1);
    parsed.hasTrack2 = isBitSet(field9, 0x2);
    parsed.hasTrack3 = isBitSet(field9, 0x4);
    info.hasDummyHash1 = isBitSet(field9, 0x8);
    info.hasDummyHash2 = isBitSet(field9, 0x10);
    info.hasDummyHash3 = isBitSet(field9, 0x20);
}

function readSerialIdTech(parsed, info, cardData) {
    var encEnd = info.encStart + info.enct1 + info.enct2 + info.enct3;
    encEnd += (info.hasDummyHash1 ? 40 : 0) + (info.hasDummyHash2 ? 40 : 0) + (info.hasDummyHash3 ? 40 : 0);

    parsed.serial = cardData.substring(encEnd, encEnd + 20);
    parsed.ksn = cardData.substring(encEnd + 20, encEnd + 40);
}

function pollOnce() {
    var loc = getCurrentLocation();
    if (loc) {
        $.ajax({
            url: '/locations/api/'+loc.id+'/tabs',
            type: 'GET',
            error: function(r, msg, e) {
                console.log('Location poll error', e);
            },
            success: function(res) {
                if (res && res.tabs && res.tabs.length) {
                    tabs = res.tabs;
                    $('#checkedInCount').text(res.tabs.length).show();
                } else {
                    tabs = null;
                    $('#checkedInCount').hide();
                }
            }
        })
    }
}

function pollTabs() {
    pollOnce();
    setTimeout(pollTabs, 10000);
}

function deepFreeze(invoice) {
    var frozen = JSON.parse(JSON.stringify(inv));
    for (var i = 0; i < frozen.items.length; i++) {
        delete frozen.items[i]._product;
    }
    return frozen;
}
