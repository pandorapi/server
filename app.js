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

    var basic = (action, containers) => {
        if (!containers) {
            return socket.emit('docker_conteiners_' + action, null)
        }

        if (!containers[0]) {
            containers = [containers];
        }

        var dockerContent = [];

        containers.forEach(function(container) {
            docker.getContainer(container.Id)[action]((err, data) => {
                if (err) {
                    socket.emit('docker_conteiners_' + action, null)
                    return console.error(err)
                }

                if (dockerContent.indexOf(container.Id) == -1) {
                    dockerContent.push(container.Id)
                    if (action != 'inspect') {
                        docker.getContainer(container.Id).inspect((err, data) => {
                            if (err) {
                                socket.emit('docker_conteiners_' + action, null)
                                return console.error(err)
                            }

                            socket.emit('docker_conteiners_' + action, data)
                        })
                    } else {
                        socket.emit('docker_conteiners_' + action, data)
                    }
                }
            });
        });
    }

    socket
        .on('docker_create_conteiner', (optsc) => {
            docker.createContainer(options,
                function(err, container) {
                    if (err) {
                        return console.error(err)
                    }

                    container.start(function(err, data) {
                        if (err) {
                            return console.error(err)
                        }
                        console.log(data)
                    });
                });
        })
        .on('docker_list_conteiners', (all = false) => {
            docker.listContainers({
                all
            }, function(err, containers) {
                socket.emit('docker_list_conteiners', containers)
            });
        })
        .on('docker_conteiners_inspect', (containers) => {
            basic('inspect', containers);
        })
        .on('docker_conteiners_stop', (containers) => {
            basic('stop', containers);
        })
        .on('docker_conteiners_start', (containers) => {
            basic('start', containers);
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
