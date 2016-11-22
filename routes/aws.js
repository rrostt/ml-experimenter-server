var fs = require('fs');
var express = require('express');
var router = express.Router();
var aws = require('../aws');
var appConfig = require('../config.json');

router.post('/credentials', function (req, res) {
  var key = req.body.key;
  var secret = req.body.secret;
  var region = req.body.region || 'eu-west-1';

  aws.setCredentials(key, secret, region);

  res.end();
});

router.get('/list', function (req, res) {
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

router.post('/startMachine', function (req, res) {
  var instanceId = req.body.instanceId;

  aws.startMachine(
    instanceId,
    {
      host: appConfig.host,
      awsInstanceId: instanceId,
      machineId: createMachineID(),
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

  function createMachineID() {
    return 'aws-' + new Date().getTime();
  }
});

module.exports = router;
