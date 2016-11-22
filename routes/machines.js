var fs = require('fs');
var express = require('express');
var router = express.Router();
var aws = require('../aws');

var clients = [];

router.get('/', function (req, res) {
  res.json(clients.map(c => c.client.getStateObject()));
});

router.post('/set-aws-credentials', function (req, res) {
  var key = req.body.key;
  var secret = req.body.secret;

  aws.setCredentials(key, secret, 'eu-west-1');

  res.end();
});

router.post('/launch', function (req, res) {
  // AMI-id
  //
  // launch instance
  // wait for instance to come online
  // upload config (with target-host, credentials (secret token?), user, project)
  // start client service

  var ami = req.body.ami;
  var instanceType = req.body.instanceType;

  if (!aws.hasCredentials()) {
    res.send({
      error: 'no credentials',
    });
    return;
  }

  aws.launch(
    {
      ImageId: ami,
      InstanceType: instanceType,
    },
    function (err, instance) {
      if (err) {
        res.json({
          error: err,
        });
      } else {
        res.json({
          status: 'ok',
          instance: instance,
        });
        // aws.configure(instance);
      }
    }
  );
});

router.get('/:id/sync', function (req, res) {
  var id = req.params.id;

  var client = clients.find(client => client.id == id).client;
  client.sync();
  res.end();
});

router.get('/:id/run', function (req, res) {
  var id = req.params.id;
  var file = req.query.file;

  if (!file) {
    file = 'train.py';
  }

  var client = clients.find(client => client.id == id).client;
  client.run('./docker_run.sh ' + file);
  res.end();
});

router.get('/:id/stop', function (req, res) {
  var id = req.params.id;

  var client = clients.find(client => client.id == id).client;
  client.stop();
  res.end();
});

router.get('/:id/clear-stdout', (req, res) => {
  var id = req.params.id;

  var client = clients.find(client => client.id == id).client;
  client.clearStdout();
  res.end();
});

router.get('/:id/clear-stderr', (req, res) => {
  var id = req.params.id;

  var client = clients.find(client => client.id == id).client;
  client.clearStderr();
  res.end();
});

router.clients = clients;

module.exports = router;
