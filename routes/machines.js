var fs = require('fs');
var express = require('express');
var router = express.Router();
var UserSessions = require('../userSessions');
var io = require('socket.io-client');
var SocketConnections = require('../socket-connections');

router.get('/', function (req, res) {
  res.json(req.userSession.getClientStates());
});

router.post('/connect', function (req, res) {
  var host = req.body.host;

  console.log('making io connection to ' + host);
  var socket = io.connect(
    host,
    {
      reconnection: false,
    }
  );

  socket.on('connect_error', function (err) {
    console.log('Connection Failed', err);
    res.json({ error: 'unable to connect' });
  });

  socket.on('connect', function () {
    SocketConnections.setupNewConnection(socket);
    res.json({});
  });

  socket.on('error', function (err) {
    console.log('socket connect error', err);
  });
});

router.get('/:id/sync', function (req, res) {
  var id = req.params.id;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.sync();
  res.end();
});

router.get('/:id/run', function (req, res) {
  var id = req.params.id;
  var file = req.query.file;

  if (!file) {
    file = 'train.py';
  }

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.run('./docker_run.sh ' + file);
  res.end();
});

router.get('/:id/stop', function (req, res) {
  var id = req.params.id;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.stop();
  res.end();
});

router.get('/:id/clear-stdout', (req, res) => {
  var id = req.params.id;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.clearStdout();
  res.end();
});

router.get('/:id/clear-stderr', (req, res) => {
  var id = req.params.id;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.clearStderr();
  res.end();
});

router.post('/:id/rename', (req, res) => {
  var id = req.params.id;
  var newName = req.body.newName;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.rename(newName);
  res.end();
});

module.exports = router;
