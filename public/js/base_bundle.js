'use strict';

// TraceKit goes straight to global window
require('../components/tracekit/tracekit');

TraceKit.remoteFetching = false;
TraceKit.report.subscribe(function apps4hereLogger(error) {
    try {
        if (!error.stack) {
            error.stack = (new Error('force-added stack')).stack;
            if (error.stack) {
                error.stack = error.stack.toString();
            }
        }

        $.ajax({
            url: '/log/error',
            type: 'POST',
            cache: false,
            data: {
                _csrf: _csrf,
                error: JSON.stringify(error)
            }
        })
            .fail(function jserrorPostFail() {
                console.error('error FAILED to send');
            })
            .done(function jserrorPostDone(resp) {
                console.warn('error sent ' + resp);
                if (resp.status === 'error') {
                    // Do something.
                }
            });
    } catch (e) {
        console.error('Error reporting failed.', e);
    }

});