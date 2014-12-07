var ServerSocket = function (hardware) {
    this.hardware = hardware;
    this.socket = null;
};

$.extend(ServerSocket.prototype, $.eventEmitter);

ServerSocket.prototype.setup = function () {

};

ServerSocket.prototype.sendIfOpen = function (msg, data) {
    if (this.socket) {
        this.socket.emit(msg, data);
    }
};

ServerSocket.prototype.attach = function (device) {
    this.device = device;
    if (this.socket) {
        this.socket.emit('deviceAttach',{id:device._id});
    }
}

ServerSocket.prototype.detach = function () {
    if (this.device) {
        if (this.socket) {
            this.socket.emit('deviceDetach', {id: this.device._id});
        }
        delete this.device;
    }
}

ServerSocket.prototype.subscribe = function (amount) {
    this.amount = amount;
    if (this.socket) {
        this.hardware.spinner(false);
        this.socket.emit('deviceSubscribe',{
            id:this.device._id,
            subscription: {
                amount: this.amount,
                types: ['Mag']
            }
        });
    }
};

ServerSocket.prototype.unsubscribe = function () {
    if (this.amount) {
        if (this.socket) {
            this.socket.emit('deviceUnsubscribe',{
                id:this.device._id
            });
        }
        delete this.amount;
    }
};

ServerSocket.prototype.connect = function () {
    if (this.socket !== null) {
        return; // already connected
    }
    var room, self = this;
    var socket = this.socket = io();

    function reinit() {
        if (self.device) {
            self.attach(self.device);
        }
        if (self.amount) {
            self.subscribe(self.amount);
        }
    }

    socket.on('connect', reinit);
    socket.on('deviceUpdate', function (e) {
        console.log('deviceUpdate');
        room = e.room;
        socket.emit('devicePing', {room: e.room});
        reinit();
    });
    socket.on('devicePong', function (e) {
        console.log('devicePong', e);
    });
    socket.on('deviceEvent', function (e) {
        console.log('deviceEvent', e);
        self.emit('deviceEvent',e);
    });
    socket.on('deviceSubscribed', function (e) {
        console.log('deviceSubscribed');
        self.hardware.spinner(false);
    });
    ['error','disconnect','reconnect','reconnecting','reconnect_error','reconnect_failed'].forEach(function (f) {
       socket.on(f, function (a) {
           console.log('Socket ' + f);
       });
    });
};

module.exports = ServerSocket;
