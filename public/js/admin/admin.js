function setupLogPage() {
    var socket = io();
    socket.on('connect', function () {
        console.log('connect');
        socket.emit('logs',{on:true});
    });
}
