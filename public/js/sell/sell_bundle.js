window['PayPalHerePOS'] = function PayPalHerePOSfn(options) {

    options = $.extend({}, options);

    accounting.settings.currency.symbol = _currency.symbol;

    this.storage = new (require('./storage'))(_email.replace('.', ''));
    this.locationManager = new (require('./location'))();
    this.invoiceManager = new (require('./invoiceManager'))(this.locationManager);
    this.orderManager = new (require('./savedOrders'))(this.locationManager, this.invoiceManager);
    this.checkin = new (require('./checkin'))(this.locationManager, this.invoiceManager);
    this.hardware = options.hardware === false ? null : new (require('./hardware'))(this.locationManager);
    this.serverSocket = new (require('./serverSocket'))(this.hardware);
    this.catalog = new (require('./catalog'))(this.invoiceManager);
    this.payment = new (require('./payment'))(this.locationManager, this.invoiceManager, this.checkin);
    this.cart = new (require('./cart'))(this.invoiceManager, this.checkin, this.payment);
    this.customerInfo = new (require('./customerInfo'))(this.invoiceManager, this.cart, this.checkin, this.locationManager);
    this.receipt = new (require('./receipt'))(this.invoiceManager);
    var self = this;

// TODO this was basically completely refactored from a really long "procedural" javascript
// implementation. So there are still all sorts of artifacts of that in the object structures.
// We need to go one by one and just rethink the proper interface for each of these managers
// and add more event triggering, etc. But don't think that this structure is the "intent,"
// it's just a simple division of a big ball of code.
    $(function () {
        self.locationManager.getBrowserLocation();
        [
            self.invoiceManager,
            self.cart,
            self.locationManager,
            self.hardware,
            self.catalog,
            self.orderManager,
            self.serverSocket,
            self.checkin,
            self.payment,
            self.customerInfo,
            self.receipt
        ].forEach(function (m) {
                if (m) {
                    m.setup(self.storage);
                }
            });

        // Wire up event routing

        // When there is a hardware device selected, we need the web socket up
        if (self.hardware) {
            self.hardware.on('changed', function (e, device) {
                self.serverSocket.attach(device);
                self.serverSocket.connect();
            });
        }

        // Let the server know about order changes when the socket is up
        self.cart.on('render', function (e,info) {
            self.serverSocket.sendIfOpen('activeOrder', {inv: self.invoiceManager.deepFreeze(), tot: info.totals});
        });

        // When we're ready to take payment
        self.cart.on('selectingPaymentType', function (e, totals) {
            if (self.hardware && self.hardware.device) {
                self.serverSocket.subscribe(totals.total.toString());
            }
        });

        self.payment.on('hidden', function (e) {
            self.serverSocket.unsubscribe();
        });

        self.locationManager.on('selected', function () {
            if (self.hardware) {
                self.hardware.load();
            }
            self.checkin.ensurePolling();
            self.orderManager.update();
        });

        self.serverSocket.on('deviceEvent', function (e, args) {
            if (args.type === 'Swipe') {
                self.payment.swipeDetected(args.data);
            }
        });

        $('[data-toggle="tooltip"]').tooltip();

    });

};
