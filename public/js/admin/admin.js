function setupLogPage() {
    var socket = io(), ctr = 0, autoScroll = true, logsElement = $('#logs');
    $('#clear').on('click', function () {
       logsElement.empty();
    });
    $('#autoScroll').on('click', function () {
       autoScroll = !autoScroll;
        $('#autoScroll>span').toggleClass('glyphicon-check').toggleClass('glyphicon-unchecked');
        logsElement.scrollTop(logsElement[0].scrollHeight);
    });
    socket.on('connect', function () {
        socket.emit('joinLogs', {on: true});
    });
    socket.on('log', function (d) {
        var nodes = $('#logs>li');
        if (nodes.length > 500) {
            upAndOut($(nodes[outQ.length]));
        }
        // Create the log line with host, message, level
        var li = $('<li></li>');
        li.attr('id', 'el' + (ctr++));
        li.addClass(d.level);
        if (d.hostname) {
            li.append('<span class="host"></span>').text(d.hostname);
        }
        li.append('<span class="message"></span>').text(d.message);
        logsElement.append(li);
        if (autoScroll) {
            elt.scrollTop(logsElement[0].scrollHeight);
        }
    });

    var outQ = [];
    // We need to slide these up in series (as far as I can tell)
    function upAndOut(first) {
        if (first) {
            outQ.push(first);
        }
        if (outQ.length === 1) {
            // Start sliding
            slideUp();
        }
    }

    function slideUp() {
        if (outQ.length === 0) {
            // Nothing more to do here.
            return;
        }
        var el = outQ[0];
        el.slideUp({
            queue: false,
            always: function () {
                outQ.shift();
                el.remove();
                slideUp();
            }
        });
    }
}
