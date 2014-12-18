var Receipt = function (invoiceManager) {
    this.invoiceManager = invoiceManager;
};

Receipt.prototype.setup = function () {
    var self = this;
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
        var data = { invoiceId: self.invoiceManager.invoice.payPalId, _csrf: _csrf };
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
};

module.exports = Receipt;
