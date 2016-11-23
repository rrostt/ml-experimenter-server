var fs = require('fs');
var express = require('express');
var router = express.Router();
var AwsConnection = require('../aws');
var appConfig = require('../config.json');

var awsCredentials = {};

router.post('/credentials', function (req, res) {
  var key = req.body.key;
  var secret = req.body.secret;
  var region = req.body.region || 'eu-west-1';

  awsCredentials = {
    accessKeyid: key,
    secretAccessKey: secret,
    region: region,
  };

  //  aws.setCredentials(key, secret, region);

  res.end();
});

router.get('/list', function (req, res) {
  var aws = new AwsConnection(awsCredentials);
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

router.post('/launch', function (req, res) {
  // AMI-id
  //
  // launch instance
  // wait for instance to come online
  // upload config (with target-host, credentials (secret token?), user, project)
  // start client service

  var ami = req.body.ami;
  var instanceType = req.body.instanceType;

  var aws = new AwsConnection(awsCredentials);

  // if (!aws.hasCredentials()) {
  //   res.send({
  //     error: 'no credentials',
  //   });
  //   return;
  // }

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

  aws.on('aws-instance', (data) => {
    req.userSession.emitOnUi('aws', data);
  });
});

router.post('/terminate', function (req, res) {
  var instanceId = req.body.instanceId;

  var aws = new AwsConnection(awsCredentials);

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

router.post('/startMachine', function (req, res) {
  var instanceId = req.body.instanceId;

  var aws = new AwsConnection(awsCredentials);

  aws.startMachine(
    instanceId,
    {
      host: appConfig.host,
      awsInstanceId: instanceId,
      machineId: createMachineID(),
      accessToken: req.body.accessToken,
    },
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

module.exports = router;
