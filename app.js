// forever start -c "/home/pi/.nvm/versions/node/v6.3.0/bin/node" "/home/pi/Pandora/server/app.js"

var io = require('socket.io').listen(24326);
var ss = require('socket.io-stream');
var path = require('path');
var exec = require('exec');
var Docker = require('dockerode');
var fs = require('fs');
var dockerStbin = require('./lib/docker/stbin');

var socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
var stats = fs.statSync(socket);

if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
}

var docker = new Docker({
    socketPath: socket
});

io.on('connection', function(socket) {
    var address = socket.handshake.headers.host;
    console.log('New connection from ' + address);

    var socket = ss(socket);

    var basic = (action, containers, callback) => {
        if (!containers) {
            return socket.emit('docker_conteiners_' + action, null)
        }

        if (!containers[0]) {
            containers = [containers];
        }

        var dockerContent = [];

        containers.forEach(function(container) {
            var id = container.Id || container.id
            docker.getContainer(id)[action]((err, data) => {
                if (err) {
                    callback(err, null)
                    return console.error(err)
                }

                if (dockerContent.indexOf(id) == -1) {
                    dockerContent.push(id)
                    if (action != 'inspect' && action != 'remove') {
                        docker.getContainer(id).inspect((err, data) => {
                            if (err) {
                                return callback(err, null)
                            }

                            return callback(null, data)
                        })
                    } else {
                        return callback(null, data)
                    }
                }
            });
        });
    }

    socket
        .on('hello', (ev) => {
            socket.emit(ev, new Date().getTime())
        })
        .on('docker_create_conteiner', (ev, optsc) => {
            docker.createContainer(optsc,
                function(err, container) {
                    if (err) {
                        return console.error(err)
                    }

                    basic('inspect', container, (err, inspect) => {
                        socket.emit(ev, err || inspect)
                    });

                    container.start(function(err, data) {
                        if (err) {
                            return console.error(err)
                        }
                    });
                });
        })
        .on('docker_conteiners_remove', (ev, containers) => {
            basic('remove', containers, (err) => {
                socket.emit(ev, err || true)
            });
        })
        .on('docker_list_conteiners', (ev, all) => {
            docker.listContainers(all, function(err, containers) {
                socket.emit(ev, containers)
            });
        })
        .on('docker_list_images', (ev) => {
            docker.listImages((err, images) => {
                socket.emit(ev, images)
            })
        })
        .on('docker_conteiners_inspect', (ev, containers) => {
            basic('inspect', containers, (err, data) => {
                socket.emit(ev, err || data)
            });
        })
        .on('docker_conteiners_stop', (ev, containers) => {
            basic('stop', containers, (err, data) => {
                basic('inspect', containers, (err, data) => {
                    socket.emit(ev, err || data)
                });
            });
        })
        .on('docker_conteiners_start', (ev, containers) => {
            basic('start', containers, (err, data) => {
                basic('inspect', containers, (err, data) => {
                    socket.emit(ev, err || data)
                });
            });
        })
        .on('docker_pull', function(repoTag) {
            console.log('Pull ', repoTag)
            docker.pull(repoTag, function(err, stream) {
                docker.modem.followProgress(stream, (err, output) => {
                        if (err) {
                            socket.emit('docker_pull', {
                                err
                            })
                            return console.error(err)
                        }

                        socket.emit('docker_pull', {
                            output
                        })
                    },
                    (Event) => {
                        socket.emit('docker_pull', {
                            "event": Event
                        })
                    });
            })
        });
});
