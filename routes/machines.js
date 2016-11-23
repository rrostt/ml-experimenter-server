var fs = require('fs');
var express = require('express');
var router = express.Router();
var UserSessions = require('../UserSessions');
var aws = require('../aws');

//var clients = [];

router.get('/', function (req, res) {
//  res.json(clients.map(c => c.client.getStateObject()));
  res.json(req.userSession.getClientStates());
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

// router.clients = clients;

module.exports = router;
