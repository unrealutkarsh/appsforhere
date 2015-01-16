var idtech = require('./idtech');

var Payment = function (locationManager, invoiceManager, checkinManager) {
    this.invoiceManager = invoiceManager;
    this.locationManager = locationManager;
    this.checkinManager = checkinManager;
    this.eventCounter = 0;
};

$.extend(Payment.prototype, $.eventEmitter);

var paycodeRegEx = /PPPAY\*ACC\:([0-9]+)\*DT\:([0-9]+)/i;

Payment.prototype.setup = function () {
    var self = this;
    $('#paymentTypeModal').on('shown.bs.modal', function () {
        $('#keyboardWatcher').focus();
    }).on('hidden.bs.modal', function () {
        self.eventCounter = 0;
    });
    $('#paymentTypeModal').on('hidden.bs.modal', function () {
        self.emit('hidden');
    });

    $('#paymentTypeSelector').on('click', 'button', function () {
        var newView = $('#' + $(this).data('value'));
        if (self.paymentTypeView && self.paymentTypeView != newView) {
            self.paymentTypeView.hide();
        }
        self.paymentTypeView = newView;
        self.paymentTypeView.show();
        var f = $('input[data-autofocus="1"]', self.paymentTypeView);
        if (f && f.length) {
            f.focus();
        } else {
            $('#keyboardWatcher').focus();
        }
    });

    var check = function () {
        self.checkKeyboard($(this));
    };

    $('#keyboardWatcher').on('keyup', check).on('change', check)
        .on('blur', function () {
            var myEvent = ++self.eventCounter;
            setTimeout(function () {
                if (self.eventCounter == myEvent) {
                    $('#keyboardHasFocus').hide();
                    $('#keyboardNeedsFocus').show();
                }
            }, self.eventCounter == 1 ? 0 : 50);
        }).on('focus', function () {
            var myEvent = ++self.eventCounter;
            this.value = '';
            setTimeout(function () {
                if (self.eventCounter == myEvent) {
                    $('#keyboardHasFocus').show();
                    $('#keyboardNeedsFocus').hide();
                }
            }, 50);
        });

    $('#keyboardGetFocus').on('click', function (e) {
        e.preventDefault();
        $('#keyboardWatcher').focus();
    });

    $('#cashTendered').money_field({});
    $('#cashChange').money_field({});
    $('#cashTendered').on('keyup', function (e) {
        var amt = Invoice.Number($(this).val()).minus(self.invoiceManager.invoice.calculate().total);
        $('#cashChange').val(amt.greaterThan(0) ? amt : '');
    });

    // Payment type buttons
    $('#doCheckinPayment').on('click', function (e) {
        e.preventDefault();
        self.checkinPayment();
    });

    $('#doCashPayment').on('click', function (e) {
        e.preventDefault();
        var tender = $('#cashTendered').val(), inv = self.invoiceManager.invoice;
        if (tender && tender.length) {
            inv.receiptDetails = inv.receiptDetails || {};
            inv.receiptDetails.payment = inv.receiptDetails.payment || {};
            inv.receiptDetails.payment.tendered = tender;
        }
        self.otherPayment(this, 'cash');
    });

    $('#doCheckPayment').on('click', function (e) {
        e.preventDefault();
        var inv = self.invoiceManager.invoice;
        var num = $('#checkNumber').val();
        var name = $('#checkName').val();
        var ph = $('#checkPhone').val();
        if ((num && num.length) || (name && name.length) || (ph && ph.length)) {
            inv.receiptDetails = inv.receiptDetails || {};
            inv.receiptDetails.payment = inv.receiptDetails.payment || {};
            inv.receiptDetails.payment.check = {num: num, name: name, phone: ph};
        }
        self.otherPayment(this, 'check');
    });

    $('#doCardPayment').on('click', function (e) {
        e.preventDefault();
        var exp = $.payment.cardExpiryVal($('#card-expiration').val());
        this.paymentRequest = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            paymentType: 'card',
            card: {
                inputType: "keyIn",
                accountNumber: $('#card-number').val(),
                expirationMonth: exp.month,
                expirationYear: exp.year,
                cvv: $('#card-cvc').val(),
                postalCode: $('#card-postal').val()
            },
            invoice: this.invoiceManager.deepFreeze()
        };
        $('#card-number').val('');
        $('#card-cvc').val('');
        $('#card-postal').val('');
        $('#card-expiration').val('');
        var card = paymentRequest.card.accountNumber;
        if (card && card.length > 4) {
            card = card.substring(card.length - 4);
        }
        this.confirm('to the card ending in ' + card);
    });

    $('#doSaveForLater').on('click', function (e) {
        e.preventDefault();
        var loc = self.locationManager.getCurrentLocation();
        var l = Ladda.create(this);
        l.start();
        var frozen = self.invoiceManager.deepFreeze();
        $.ajax({
            dataType: 'json',
            data: {invoice: frozen, name: $('#orderName').val(), _csrf: _csrf},
            url: window.ajaxRoot + '/sell/saved/' + loc.id,
            type: 'POST',
            cache: false,
            success: function (data) {
                l.stop();
                self.invoiceManager.invoice.payPalId = data.invoiceId;
                $('#orderName').val('');
                self.invoiceManager.newOrder();
                $('#paymentTypeModal').modal('hide');
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

    // Confirmation page buttons
    $('#paymentCompleteModal').on('shown.bs.modal', function (e) {
        $("#receiptDestination").focus();
    });

    $('#doPayment').on('click', function () {
        self.sendRequest(this, $('#paymentConfirmModal'));
    });

    $('#newOrder').on('click', function () {
        self.invoiceManager.newOrder();
        $('#paymentCompleteModal').modal('hide');
    });

    // Manual card entry
    var validateDetails = function () {
        $('.cc-num').payment('formatCardNumber');
        $('.cc-exp').payment('formatCardExpiry');
        $('.cc-cvc').payment('formatCardCVC');
    };

    // this runs the above function every time stuff is entered into the card inputs
    $('.paymentInput').bind('change paste keyup', function () {
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

};

Payment.prototype.show = function () {
    if (!this.paymentTypeView) {
        this.paymentTypeView = $('#noEntry');
        this.paymentTypeView.show();
    }
    $('#paymentTypeModal').modal();
};

Payment.prototype.checkKeyboard = function (elt) {
    var v = elt.val();
    try {
        var card = idtech.decodeIdTech(v);
        this.swipeDetected(card);
        return;
    } catch (x) {
        // Not idTech
    }
    var match = v.match(paycodeRegEx);
    if (match) {
        this.paycodeDetected(match[1]);
        return;
    }
};

Payment.prototype.authRequired = function (data) {
    $('#pinEntryModal').modal('hide');
    this.authPending = data;
    this.paymentRequest = {
        latitude: this.locationManager.coords.latitude,
        longitude: this.locationManager.coords.longitude,
        paymentType: 'card',
        dateTime: new Date().toISOString(),
        card: {
            pinPresent: data.pinVerified,
            reader: {
                vendor: data.vendor,
                readerSerialNumber: data.serial
            },
            emvData: data.emv,
            signatureRequired: data.signatureRequired,
            inputType: 'chip'
        },
        invoice: this.invoiceManager.deepFreeze()
    };
    this.doCardRequest(data);
};

Payment.prototype.swipeDetected = function (data) {
    this.paymentRequest = {
        latitude: this.locationManager.coords.latitude,
        longitude: this.locationManager.coords.longitude,
        paymentType: 'card',
        dateTime: new Date().toISOString(),
        card: {
            reader: {
                vendor: data.vendor,
                keySerialNumber: data.ksn,
                readerSerialNumber: data.serial
            },
            track1: data.track1,
            track2: data.track2,
            inputType: 'swipe'
        },
        invoice: this.invoiceManager.deepFreeze()
    };
    this.doCardRequest(data);
};

Payment.prototype.doCardRequest = function (data) {
    if (data.track1Masked) {
        var re = /^%([A-Z\*])([0-9\*]{1,19})\^([^\^]{2,26})\^([0-9\*]{4}|\^)([0-9\*]{3}|\^)([^\?]+)\?\*?$/;
        var m = data.track1Masked.match(re);
        if (m) {
            var card = m[2];
            if (card && card.length > 4) {
                card = card.substring(card.length - 4);
            }
            this.confirm('to the card ending in ' + card);
        }
    } else if (data.track2Masked) {
        var re = /^;([0-9\*]{1,19})=([^\?]+)\?\*?$/;
        var m = data.track2Masked.match(re);
        if (m) {
            var card = m[1];
            if (card && card.length > 4) {
                card = card.substring(card.length - 4);
            }
            this.confirm('to the card ending in ' + card);
        }
    } else if (data.maskedPan) {
        this.confirm('to the card ending in ' + data.maskedPan.substring(data.maskedPan.length - 4));
    } else {
        this.confirm('to the card');
    }
};

Payment.prototype.otherPayment = function (button, type) {
    this.paymentRequest = {
        latitude: this.locationManager.coords.latitude,
        longitude: this.locationManager.coords.longitude,
        paymentType: type,
        invoice: this.invoiceManager.deepFreeze()
    };
    this.sendRequest(button, $('#paymentTypeModal'));
};

Payment.prototype.checkinPayment = function () {
    if (!this.checkinManager.selectedTab) {
        alert('You must select a customer first.');
        return;
    }
    this.paymentRequest = {
        latitude: this.locationManager.coords.latitude,
        longitude: this.locationManager.coords.longitude,
        paymentType: 'tab',
        tabId: this.checkinManager.selectedTab.id,
        // Deep freeze the invoice.
        invoice: this.invoiceManager.deepFreeze()
    };
    this.confirm('to ' + this.checkinManager.selectedTab.customerName + ' using PayPal');
};

Payment.prototype.confirm = function (summary) {
    $('#keyboardWatcher').val('');
    $('#paymentTypeModal').modal('hide');
    var tots = this.invoiceManager.invoice.calculate();
    $('#confirmAmount').text(m$(tots.total.toString()));
    $('#summary').text(summary);
    $('#paymentConfirmModal').modal();
};

Payment.prototype.paycodeDetected = function (data) {
    this.paymentRequest = {
        latitude: this.locationManager.coords.latitude,
        longitude: this.locationManager.coords.longitude,
        paymentType: 'payCode',
        payCode: data,
        // Deep freeze the invoice.
        invoice: this.invoiceManager.deepFreeze()
    };
    this.confirm('using PayPal');
};

Payment.prototype.pinInProgress = function (data) {
    $('#paymentTypeModal').modal('hide');
    $('#waitEmvModal').modal('hide');
    $('#pinEntryModal').modal();
};

Payment.prototype.cardInProgress = function (data) {
    $('#paymentTypeModal').modal('hide');
    $('#waitEmvModal').modal();
};

Payment.prototype.finalizeEmvPayment = function (options) {
    this._emvModal.modal('hide');
    $('#waitEmvModal').modal();
    var self = this, finalizeRequest = {
        invoiceId: this.invoiceManager.invoice.payPalId,
        emvData: options.emv,
        responseCode: options.responseCode
    }, inv = this.invoiceManager.invoice;
    $.ajax({
        dataType: 'json',
        data: {payload: finalizeRequest, _csrf: _csrf},
        url: window.ajaxRoot + '/sell/' + options.transactionHandle + '/finalize',
        type: 'POST',
        cache: false,
        success: function (data) {
            inv.transactionId = data.transactionNumber;
            $('#waitEmvModal').modal('hide');
            options.response = data;
            self.emit('transactionComplete', options);
            console.log(bootbox.alert('Transaction complete, please remove the card.', function () {
                $('#paymentCompleteModal').modal();
            }));
        },
        error: function (xhr, type, error) {
            var msg;
            if (xhr.responseJSON && xhr.responseJSON.developerMessage) {
                msg = xhr.responseJSON.developerMessage;
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else {
                msg = error;
            }
            bootbox.dialog({
                message: msg,
                title: 'Transaction Failed',
                buttons: {
                    retry: {
                        label: 'Retry',
                        className: 'btn-primary',
                        callback: function () {
                            self.finalizeEmvPayment(options);
                        }
                    },
                    cancel: {
                        label: 'Cancel',
                        className: 'btn-danger',
                        callback: function () {
                            // TODO Go back to payment choice?
                        }
                    }
                }
            })
        }
    })
};

Payment.prototype.sendRequest = function (button, fromModal) {
    var l = Ladda.create(button), rq = this.paymentRequest, self = this;
    var inv = this.invoiceManager.invoice;
    l.start();
    $.ajax({
        dataType: 'json',
        data: {payload: this.paymentRequest, _csrf: _csrf},
        url: window.ajaxRoot + '/sell',
        type: 'POST',
        cache: false,
        success: function (data) {
            l.stop();
            inv.payPalId = data.invoiceId;
            if (rq.paymentType && rq.card && rq.card.inputType === 'chip') {
                // Two step auth required, but need to talk to the device first.
                self._emvModal = fromModal;
                self.emit('emvContinuation', {result: data, event: self.authPending});
            } else {
                inv.transactionId = data.transactionId;
                fromModal.modal('hide');
                $('#paymentCompleteModal').modal();
            }
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
};

module.exports = Payment;
