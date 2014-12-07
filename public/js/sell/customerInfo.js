var CustomerInfo = function (invoiceManager, cart, checkinManager, locationManager) {
    this.invoiceManager = invoiceManager;
    this.checkinManager = checkinManager;
    this.cart = cart;
    this.locationManager = locationManager;
};

$.extend(CustomerInfo.prototype, $.eventEmitter);

CustomerInfo.prototype.setup = function () {
    var self = this;
    // TODO probably fire events from here and have checkin manager bring up UI
    $('#customerInfo').on('click', 'td.user', function (e) {
        $('#checkinGrid').repeater('render');
        $('#checkinModal').modal();
    });

    $('#customerInfo').on('click', 'td.info', function (e) {
        var inv = self.invoiceManager.invoice;
        if (inv.payerEmail && inv.payerEmail !== 'noreply@here.paypal.com') {
            $('#customerEmail').val(inv.payerEmail);
        }
        var l = self.locationManager.getCurrentLocation();
        if (l && l.address) {
            $('#customerCountry').val(l.address.country);
        }
        if (self.invoiceManager.invoice.billingInfo) {
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

    $('#saveCustomerInfo').on('click', function (e) {
        e.preventDefault();
        $('#customerInfoModal').modal('hide');
        var inv = self.invoiceManager.invoice;
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
                if (!bi.address) {
                    bi.address = {};
                }
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
        self.cart.updateCustomerInfo();
    });

    self.cart.updateCustomerInfo();
};

module.exports = CustomerInfo;

function neVal(selector) {
    var x = $(selector).val();
    if (x && x.length > 0) {
        return x;
    }
    return null;
}

