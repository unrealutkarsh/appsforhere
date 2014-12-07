var InvoiceManager = function (locationManager) {
    this.locationManager = locationManager;
    this.currency = 'USD';
};

$.extend(InvoiceManager.prototype, $.eventEmitter);

InvoiceManager.prototype.setup = function () {
    this.invoice = new Invoice(this.currency);
};

InvoiceManager.prototype.newOrder = function (inv) {
    this.invoice = inv || new Invoice(this.currency);
    this.emit('clear');
    $('#customerPhoto').attr('src', '/media/small_avatar.png')
    var rd = $('#receiptDestination');
    rd.val('');
    if (rd.data('originalph')) {
        rd.attr('placeholder', rd.data('originalph'));
    }
    $('#receiptType').text('@ | #');
    $('#smsDisclaimer').hide();
    $('#cartGrid').repeater('render');
};

InvoiceManager.prototype.addMerchantInfo = function (invoice) {
    var loc = this.locationManager.getCurrentLocation();
    if (loc) {
        invoice.merchantInfo = invoice.merchantInfo || {};
        invoice.merchantInfo.address = loc.address;
        invoice.merchantInfo.businessName = loc.name;
        if (!invoice.logoUrl && loc.logoUrl) {
            invoice.logoUrl = loc.logoUrl;
        }
    }
};

InvoiceManager.prototype.deepFreeze = function (invoice) {
    invoice = invoice || this.invoice;
    var frozen = JSON.parse(JSON.stringify(invoice));
    for (var i = 0; i < frozen.items.length; i++) {
        delete frozen.items[i]._product;
        delete frozen.items[i]._options;
    }
    this.addMerchantInfo(frozen);
    return frozen;
};

module.exports = InvoiceManager;
