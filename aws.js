const EventEmitter = require('events');
var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
var NodeSsh = require('node-ssh');
var fs = require('fs');
var tmp = require('tmp');

var lib = new EventEmitter();

function AwsConnection(config) {
  var _this = this;

  EventEmitter.call(this);

  ec2 = new AWS.EC2({
    accessKeyId: config.accessKeyid,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
  });

  this.list = list;
  this.launch = launch;
  this.terminate = terminate;
  this.getInstanceInfo = getInstanceInfo;
  this.startMachine = startMachine;

  function list(cb) {
    console.log('listing instances');

    ec2.describeInstances(
      {
        Filters: [
          {
            Name: 'tag-key',
            Values: [
              'MLE',
            ],
          },
        ],
      },
      function (err, data) {
        if (err) {
          console.log('error getting instances');
          cb(err);
          return;
        }

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
    // setAWSConfig();

    var params = {
      ImageId: config.ImageId, // Amazon Linux AMI x86_64 EBS
      InstanceType: config.InstanceType, //'t1.micro',
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: ['sg-4bf2402d'],
      KeyName: 'devenv-key',
    };

    _this.emit('aws-instance', { state: 'launching' });

    ec2.runInstances(params, function (err, data) {
      if (err) {
        _this.emit('aws-instance', { state: 'error', errorReason: 'Unable to run instance', details: err });
        console.log('Could not create instance', err);
        cb(err);
        return;
      }

      var instanceId = data.Instances[0].InstanceId;
      console.log('Created instance', instanceId);

      _this.emit('aws-instance', { state: 'starting', instanceId: instanceId });

      var tagParams = {
        Resources: [
          instanceId,
        ],
        Tags: [
          {
            Key: 'MLE',
            Value: '',
          },
        ],
      };

      ec2.createTags(tagParams, function (err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          _this.emit('aws-instance', {
            state: 'error',
            instanceId: instanceId,
            errorReason: 'Unable to add tags to instance',
            details: err,
          });
          cb(err);
          return;
        }

        // 1s delay to get ip
        setTimeout(() => {
          ec2.describeInstances(
            {
              InstanceIds: [instanceId],
            },
            function (err, data) {
              if (err) {
                _this.emit('aws-instance', { state: 'error', instanceId: instanceId, errorReason: 'Unable to get IP', details: err });
                cb(err);
                return;
              }

              console.log('ip?', data);

              var ip = data.Reservations[0].Instances[0].PublicIpAddress;

              _this.emit('aws-instance', { state: 'launched', instanceId: instanceId, ip: ip });

              cb(null, {
                instanceId: instanceId,
                ip: ip,
              });
            }
          );
        }, 1000);
      });
    });
  }

  function terminate(instanceId, cb) {
    var params = {
      InstanceIds: [
        instanceId,
      ],
    };

    ec2.terminateInstances(params, function (err, data) {
      if (err) {
        _this.emit(
          'instance',
          {
            state: 'error',
            instanceId: instanceId,
            errorReason: 'Unable to terminate',
          }
        );
        cb(err);
        return;
      } else {
        _this.emit('instance', { state: 'terminated', instanceId: instanceId });
        cb(err);
        return;
      }
    });
  }

  function getInstanceInfo(instanceId, cb) {
    // setAWSConfig();

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

  //
  // config:
  // {
  //   host; -- where to connect
  //   machineId: -- a generated machine id.
  //   accessToken: -- what token to use when connecting
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
      _this.emit('instance', {
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
              _this.emit('instance', {
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
              _this.emit('instance', {
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
                  _this.emit('instance', {
                    instance: instance,
                    status: 'service started',
                  });
                  cb(null);
                }, function (err) {
                  _this.emit('instance', {
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
                _this.emit('instance', {
                  instance: instance,
                  error: 'error uploading config',
                });
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
        _this.emit('instance', {
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

}

AwsConnection.prototype.__proto__ = EventEmitter.prototype;

module.exports = AwsConnection;
