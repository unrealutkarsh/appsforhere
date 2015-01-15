'use strict';

var logger = require('pine')();

if (process.env.NODE_ENV === 'production') {
    logger.info("Starting newrelic agent.");
    // Temporarily required to fix newrelic's invasive methods.
    require('newrelicbuster');
    require('newrelic');
} else {
    logger.info("newrelic inactive (%s).", process.env.NODE_ENV || 'no NODE_ENV set');
}

var app = new (require('./index'))();
app.once('ready', function () {
   app.listen(process.env.PORT || 8000);
});