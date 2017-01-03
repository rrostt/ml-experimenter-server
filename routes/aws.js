var fs = require('fs');
var express = require('express');
var router = express.Router();
var AwsConnection = require('../aws');
var appConfig = require('../config.json');
var Settings = require('../models/settings');

// var awsCredentials = {};
function awsCredentialsFromSettings(settings) {
  return {
    accessKeyId: settings.awsKey || '',
    secretAccessKey: settings.awsSecret || '',
    region: settings.awsRegion || 'eu-west-1',
  };
}

function getAwsConnectionFromUser(login) {
  return Settings.forUser(login)
    .then(awsCredentialsFromSettings)
    .then(awsCredentials =>
      new AwsConnection(awsCredentials)
    );
}

router.get('/list', function (req, res) {
  getAwsConnectionFromUser(req.user.login)
  .then(aws => {
    aws.list(function (err, instances) {
      if (err) {
        res.json({
          error: err,
        });
      } else {
        res.json(instances);
      }
    });
  });
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

  getAwsConnectionFromUser(req.user.login)
  .then(aws => {

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
        }
      }
    );

    aws.on('instance', (data) => {
      req.userSession.emitOnUi('aws', data);
    });

    aws.on('state', (data) => {
      req.userSession.emitOnUi('aws', data);
    });

  });
});

router.post('/terminate', function (req, res) {
  var instanceId = req.body.instanceId;

  getAwsConnectionFromUser(req.user.login)
  .then(aws => {

    aws.terminate(instanceId, function (err) {
      if (err) {
        res.json({
          error: err,
        });
      } else {
        res.json({});
      }
    });
  });
});

router.post('/startMachine', function (req, res) {
  var instanceId = req.body.instanceId;
  var openPort = req.body.openPort;

  getAwsConnectionFromUser(req.user.login)
  .then(aws => {

    var config = openPort ?
      {
        port: 8765,
        awsInstanceId: instanceId,
        machineId: createMachineID(),
        accessToken: req.body.accessToken,
      }
    :
      {
        host: appConfig.host,
        awsInstanceId: instanceId,
        machineId: createMachineID(),
        accessToken: req.body.accessToken,
      };

    aws.startMachine(
      instanceId,
      config,
      function (err) {
        if (err) {
          res.json({
            error: err,
          });
        } else {
          res.json({});
        }
      }
    );

    aws.on('instance', (data) => {
      req.userSession.emitOnUi('aws', data);
    });

    function createMachineID() {
      return 'aws-' + new Date().getTime();
    }
  });
});

router.get('/instanceStatus/:id', (req, res) => {
  getAwsConnectionFromUser(req.user.login)
  .then(aws => {

    aws.instanceStatus(req.params.id)
    .then(status => {
      res.json({
        status: status,
      });
    })
    .catch(err => {
      res.json({
        error: 'unable to get instance status',
      });
    });
  });
});

module.exports = router;
