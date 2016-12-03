var fs = require('fs');
var express = require('express');
var router = express.Router();
var UserSessions = require('../userSessions');

router.get('/', function (req, res) {
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

router.post('/:id/rename', (req, res) => {
  var id = req.params.id;
  var newName = req.body.newName;

  var client = req.userSession.getClientById(id); // clients.find(client => client.id == id).client;
  client.rename(newName);
  res.end();
});

module.exports = router;
