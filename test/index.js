/*global describe:false, it:false, beforeEach:false, afterEach:false*/

'use strict';

var kraken = require('kraken-js'),
    express = require('express'),
    request = require('supertest'),
    App = require('../index');

describe('/', function () {

    var app;

    this.timeout(10000);

    before(function (done) {
        app = new App();
        app.once('ready', function () {
            app.listen(1337, done);
        });
    });


    after(function (done) {
        app.close(done);
    });


    it('should serve the home page and still be open source', function (done) {
        request(app.express)
            .get('/')
            .expect(200)
            .expect('Content-Type', /html/)
            .expect(/Fork me on GitHub/)
            .end(function (err, res) {
                done(err);
            });
    });

});
