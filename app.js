var io = require('socket.io').listen(7777);
var ss = require('socket.io-stream');
var path = require('path');

io.on('connection', function(socket) {
    var address = socket.handshake.headers.host;
    console.log('New connection from ' + address);
    
    ss(socket)
        .on('hello', function(data) {
            console.log('Hello '+data)
        })
        .emit('hello', 'server!')
});
