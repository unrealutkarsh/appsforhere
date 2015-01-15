/*global describe:true, it:true, before:true, after:true */
'use strict';

var nemoFactory = require('nemo-mocha-factory'),
    plugins = require('../config/nemo-plugins'),
    nemo = {},
    App = require('../../index'),
    setup = {
        'view': ['landing']
    };

describe('Nemo @landingSuite@', function () {

    var app;

    nemoFactory({
        'plugins': plugins,
        'setup': setup,
        'context': nemo
    });

    before(function (done) {
        this.timeout(10000);

        app = new App();
        app.once('ready', function () {
            app.listen(1337, done);
        });
    });

    it('will @loadAndVerifyLandingPage@', function (done) {
        nemo.driver.get(nemo.props.targetBaseUrl);
        nemo.view.landing.pageVisible();
        nemo.view.landing.page().getText().then(function (text) {
            if (text === "Welcome to Apps for Here!") {
                done();
            } else {
                done(new Error("Didn't find text: Welcome to Apps for Here!"));
            }
        }, function (err) {
            done(err);
        });
    });

    after(function (done) {
        app.close(done);
    });

});
