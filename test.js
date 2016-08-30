var Docker = require('dockerode');
var fs = require('fs');

var socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
var stats = fs.statSync(socket);

if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
}

var docker = new Docker({
    socketPath: socket
});


docker.createContainer({
        Image: 'hypriot/rpi-dockerui',
        name: 'dockerui',
        "ExposedPorts": {
            "9000/tcp:": {}
        },
        "HostConfig": {
            "Binds": ["/var/run/docker.sock:/var/run/docker.sock"],
            "PortBindings": {
                "9000/tcp": [{
                    "HostPort": "9000"
                }]
            }
        }
    },
    function(err, container) {
        if(err){
            return console.error(err)
        }

        container.start(function(err, data) {
            if (err) {
                return console.error(err)
            }
            console.log(data)
        });
    });
