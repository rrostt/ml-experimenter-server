var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var socketio = require('socket.io');
var io = socketio(server);
var path = require('path');
var lsSync = require('./lsSync');
var bodyParser = require('body-parser');

var fileRoute = require('./routes/file');
var machinesRoute = require('./routes/machines');

var Client = require('./worker-client.js');
var clients = [];

const pwd = 'src/';

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.send('hello');
});

app.get('/files', function (req, res) {
  res.json(lsSync(pwd));
});

app.use('/file', fileRoute);
app.use('/machines', machinesRoute);

// app.get('/machines', function (req, res) {
//   res.json(clients.map(c => c.client.getStateObject()));
// });
//
// app.get('/machines/:id/sync', function (req, res) {
//   var id = req.params.id;
//
//   var client = clients.find(client => client.id == id).client;
//   client.sync();
// });
//
// app.get('/machines/:id/run', function (req, res) {
//   var id = req.params.id;
//   var file = req.query.file;
//
//   if (!file) {
//     file = 'train.py';
//   }
//
//   var client = clients.find(client => client.id == id).client;
//   client.run('./docker_run.sh ' + file);
// });
//
// app.get('/machines/:id/stop', function (req, res) {
//   var id = req.params.id;
//
//   var client = clients.find(client => client.id == id).client;
//   client.stop();
// });
//
// app.get('/machines/:id/clear-stdout', (req, res) => {
//   var id = req.params.id;
//
//   var client = clients.find(client => client.id == id).client;
//   client.clearStdout();
// });
//
// app.get('/machines/:id/clear-stderr', (req, res) => {
//   var id = req.params.id;
//
//   var client = clients.find(client => client.id == id).client;
//   client.clearStderr();
// });

server.listen(1234, 'localhost');

var uiSockets = [];
var clients = machinesRoute.clients;

io.on('connection', function (socket) {
  var client; // if this connection is a client

  console.log('connected client');

  socket.on('worker-connected', (state) => {
    console.log('new worker connected', clients.length);
    client = new Client(socket, state);
    clients.push({
      id: client.id,
      client: client,
    });
    io.emit('machines', clients.map(c => c.client.getStateObject()));

    client.on('change', () => {
      console.log('change happened', uiSockets.length);
      uiSockets.forEach(s => {
        console.log('emitting change to ui');
        s.emit('machine-state', client.getStateObject());
      });
    });
  });

  socket.on('ui-connected', () => {
    uiSockets.push(socket);
    console.log('ui connected', uiSockets.length);
    socket.emit('machines', clients.map(c => c.client.getStateObject()));
  });

  socket.on('disconnect', function () {
    console.log('client disconnected');

    if (client !== undefined) {
      clients.splice(clients.indexOf(client), 1);
      io.emit('machines', clients.map(c => c.client.getStateObject()));
    }

    if (uiSockets.indexOf(socket) !== -1) {
      uiSockets.splice(uiSockets.indexOf(socket), 1);
    }
  });
});
