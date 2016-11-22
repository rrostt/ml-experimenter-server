const EventEmitter = require('events');
var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
var NodeSsh = require('node-ssh');
var fs = require('fs');
var tmp = require('tmp');

var lib = new EventEmitter();

var config = {};

function setAWSConfig() {
  AWS.config.update({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  AWS.config.update({
    region: config.region,
  });

  ec2 = new AWS.EC2();
}

function setCredentials(key, secret, region) {
  config.accessKeyId = key;
  config.secretAccessKey = secret;
  config.region = region;
}

function hasCredentials() {
  return config.accessKeyId && config.secretAccessKey && config.region;
}

function list(cb) {
  setAWSConfig();

  ec2.describeInstances(
    {},
    function (err, data) {
      if (err) {
//        lib.emit('aws-instance', { state: 'error', instanceId: instanceId, errorReason: 'Unable to get IP', details: err });
        cb(err);
        return;
      }

      console.log('instances', data);
      var instances = data.Reservations.map(r => r.Instances[0])
        .map(instance => ({
          instanceId: instance.InstanceId,
          ip: instance.PublicIpAddress,
          state: instance.State,
        }));

      cb(null, instances);
    }
  );
}

function launch(config, cb) {
  setAWSConfig();

  var params = {
    ImageId: config.ImageId, // Amazon Linux AMI x86_64 EBS
    InstanceType: config.InstanceType, //'t1.micro',
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: ['sg-4bf2402d'],
    KeyName: 'devenv-key',
  };

  lib.emit('aws-instance', { state: 'launching' });

  ec2.runInstances(params, function (err, data) {
    if (err) {
      lib.emit('aws-instance', { state: 'error', errorReason: 'Unable to run instance', details: err });
      console.log('Could not create instance', err);
      cb(err);
      return;
    }

    var instanceId = data.Instances[0].InstanceId;
    console.log('Created instance', instanceId);

    lib.emit('aws-instance', { state: 'starting', instanceId: instanceId });

    // 1s delay to get ip
    setTimeout(() => {
      ec2.describeInstances(
        {
          InstanceIds: [instanceId],
        },
        function (err, data) {
          if (err) {
            lib.emit('aws-instance', { state: 'error', instanceId: instanceId, errorReason: 'Unable to get IP', details: err });
            cb(err);
            return;
          }

          console.log('ip?', data);

          var ip = data.Reservations[0].Instances[0].PublicIpAddress;

          lib.emit('aws-instance', { state: 'launched', instanceId: instanceId, ip: ip });

          cb(null, {
            instanceId: instanceId,
            ip: ip,
          });
        }
      );
    }, 1000);
  });
}

function getInstanceInfo(instanceId, cb) {
  setAWSConfig();

  ec2.describeInstances(
    {
      InstanceIds: [instanceId],
    },
    function (err, data) {
      if (err) {
        cb(err);
        return;
      }

      console.log(data.Reservations[0].Instances[0]);

      var ip = data.Reservations[0].Instances[0].PublicIpAddress;
      var state = data.Reservations[0].Instances[0].State;

      cb(null, {
        instanceId: instanceId,
        ip: ip,
        state: state,
      });
    }
  );
}

function configure(instance) {
  // wait until it comes alive
  // waitUntilAlive(instance)
  //   .then(uploadConfig)
  //   .then(startService);
  // upload configuration
  // start service
}

//
// config:
// {
//   host; -- where to connect
//   machineId: -- a generated machine id.
// }
function startMachine(instanceId, config, cb) {
  // 1) upload config
  // 2) run service

  getInstanceInfo(instanceId, function (err, instance) {
    if (err) {
      cb({
        error: 'unable to get instance info',
        details: err,
      });
      return;
    }

    console.log('making ssh connection to ' + instance.ip);
    lib.emit('instance', {
      instance: instance,
      status: 'connecting',
    });

    var ssh = new NodeSsh();
    ssh.connect({
      host: instance.ip,
      username: 'ubuntu',
      privateKey: '/Users/rost/Development/aws/devenv-key.pem',
    }).then(function () {
      console.log('connected');
      tmp.file(function (err, path, fd, cleanup) {
        console.log('tmp file created');

        fs.writeFile(path, JSON.stringify(config), function (err) {
          if (err) {
            cleanup();
            lib.emit('instance', {
              instance: instance,
              status: 'error',
              reason: 'error writing file ' + path,
            });
            cb({
              error: 'error writing file',
              details: err,
            });
          } else {
            console.log('uploading file');
            lib.emit('instance', {
              instance: instance,
              status: 'uploading config',
            });
            ssh.putFile(path, 'config.json').then(function () {
              //
              cleanup();

              console.log('upload done');
              lib.emit('instance', {
                instance: instance,
                status: 'config-uploaded',
              });

              ssh.execCommand('./start').then(function (result) {
                lib.emit('instance', {
                  instance: instance,
                  status: 'service started',
                });
                cb(null);
              }, function (err) {
                lib.emit('instance', {
                  instance: instance,
                  status: 'error',
                  reason: 'error starting service',
                  details: err,
                });
                cb(err);
              });
            },

            function (err) {
              cleanup();
              cb({
                error: 'error uploading config',
                details: err,
              });
            });
          }
        });
      });
    }, function() {
      console.log('error connecting');
      lib.emit('instance', {
        instance: instance,
        error: 'error connecting to server over ssh',
      });
      cb({
        error: 'unable to connect to instance',
        details: err,
      });
    });
  });
}

lib.setCredentials = setCredentials;
lib.hasCredentials = hasCredentials;
lib.list = list;
lib.launch = launch;
lib.configure = configure;
lib.startMachine = startMachine;

module.exports = lib;
