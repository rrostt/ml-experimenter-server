const EventEmitter = require('events');
var AWS = require('aws-sdk');
var NodeSsh = require('node-ssh');
var fs = require('node-fs-extra');
var tmp = require('tmp');
var path = require('path');

var Config = require('./models/aws-config');

var lib = new EventEmitter();

const TAGNAME = 'MLE';
const KEYNAME = 'mle';  // used as default or prefix to generated keyname
const GROUPNAME = 'mle';

function AwsConnection(config) {
  var _this = this;

  EventEmitter.call(this);

  var ec2 = new AWS.EC2({
    accessKeyId: config.accessKeyId,
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
              TAGNAME,
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

  function checkOrCreateSecurityGroup() {
    console.log('checking security group');
    return new Promise((resolve, reject) => {
      var params = {
        GroupNames: [
          GROUPNAME,
        ],
      };

      ec2.describeSecurityGroups(params, function (err, data) {
        if (err) {
          if (err.code == 'InvalidGroup.NotFound') {
            createSecurityGroup();
          } else {
            reject(true);
          }
        } else {
          config.securityGroupId = data.SecurityGroups[0].GroupId;
          if (data.SecurityGroups[0].IpPermissions.length == 0) {
            addSecurityPermission(data.SecurityGroups[0].GroupId);
          } else {
            resolve(true);
          }
        }

      });

      function createSecurityGroup() {
        var params = {
          Description: 'ssh open to outside world', /* required */
          GroupName: GROUPNAME, /* required */
        };
        ec2.createSecurityGroup(params, function (err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            reject(false);
          } else {
            config.securityGroupId = data.GroupId;
            addSecurityPermission(config.securityGroupId);
          }
        });
      }

      function addSecurityPermission(GroupId) {
        var params = {
          GroupId: GroupId,
          IpProtocol: 'tcp',
          FromPort: 22,
          ToPort: 22,
          CidrIp: '0.0.0.0/0',
        };
        ec2.authorizeSecurityGroupIngress(params, function (err, data) {
          if (err) {
            console.log(err, err.stack);
            reject(false);
          } else {
            resolve(true);
          }
        });
      }

    });
  }

  function checkOrCreateKeyPair(keyName) {
    console.log('checking key pair');

    return new Promise((resolve, reject) => {
      var params = {
        KeyNames: [
          keyName,
        ],
      };

      ec2.describeKeyPairs(params, function (err, data) {
        if (err) {
          console.log(err);
          if (err.code === 'InvalidKeyPair.NotFound') {
            console.log('keypair not found, creating');
            createKeyPair(keyName).then(saveKeyNameInConfig).then(resolve, reject);
          } else {
            reject(err);
          }
        } else {
          verifyKeyPairFile(keyName).then(
            () => saveKeyNameInConfig().then(resolve, reject),
            () => genNewName().then(resolve, reject)
          );
        }
      });
    });

    function saveKeyNameInConfig() {
      return Config.setForAccessKey(config.accessKeyId, 'keyName', keyName);
    }

    function genNewName() {
      var newKeyName = genKeyName();
      return checkOrCreateKeyPair(newKeyName);

      function genKeyName() {
        return KEYNAME + '-' + Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      }
    }
  }

  function verifyKeyPairFile(keyName) {
    console.log('verifying existence of keypair file on disk');
    return new Promise((resolve, reject) => {
      var filename = getKeyFilename(keyName);

      fs.access(filename, fs.F_OK, err => {
        if (!err) { // file exists
          console.log('file exists');
          resolve();
        } else {
          console.log('keyfile does not exist');
          reject();
        }
      });
    });
  }

  function createKeyPair(keyName) {
    return new Promise((resolve, reject) => {
      var params = {
        KeyName: keyName,
      };

      ec2.createKeyPair(params, function (err, data) {
        if (err) {
          console.log(err); // an error occurred
          reject(err);
        } else {
          console.log('created key');
          saveKey(keyName, data.KeyMaterial).then(resolve, reject);
        }
      });
    });
  }

  function saveKey(keyName, key) {
    return new Promise((resolve, reject) => {
      var filename = getKeyFilename(keyName);

      console.log('saving key to ' + filename);

      fs.mkdirs(path.dirname(filename), (err) => {
        if (err) {
          console.log('error creating key directories');
          reject(err);
        } else {
          fs.writeFile(filename, key, function (err) {
            if (err) {
              console.log('error writing key file', filename);
              reject(err);
            } else {
              console.log('successfully saved key file', filename);
              resolve();
            }
          });
        }
      });
    });
  }

  function getKeyFilename(keyName) {
    return path.join(
      __dirname,
      'awsKeys',
      config.accessKeyId,
      keyName + '.pem'
    );
  }

  function launch(instanceConfig, cb) {

    Config.getForAccessKey(config.accessKeyId, 'keyName', KEYNAME)
    .then(keyName => {
      checkOrCreateSecurityGroup()
      .then(() => checkOrCreateKeyPair(keyName))  // this may change the keyname
      .then(() => Config.getForAccessKey(config.accessKeyId, 'keyName', KEYNAME))
      .then((keyName) => {

        var params = {
          ImageId: instanceConfig.ImageId,  // AMI
          InstanceType: instanceConfig.InstanceType,
          MinCount: 1,
          MaxCount: 1,
          SecurityGroupIds: [config.securityGroupId],
          KeyName: keyName,
        };

        _this.emit('aws-instance', { state: 'launching' });

        ec2.runInstances(params, function (err, data) {
          if (err) {
            _this.emit('aws-instance', {
              state: 'error',
              errorReason: 'Unable to run instance',
              details: err,
            });
            console.log('Could not create instance', err);
            cb(err);
            return;
          }

          var instanceId = data.Instances[0].InstanceId;
          console.log('Created instance', instanceId);

          _this.emit('aws-instance', { state: 'checking', instanceId: instanceId });

          var tagParams = {
            Resources: [
              instanceId,
            ],
            Tags: [
              {
                Key: TAGNAME,
                Value: '',
              },
            ],
          };

          ec2.createTags(tagParams, function (err, data) {
            if (err) {
              console.log(err, err.stack); // an error occurred
              _this.emit('aws-instance', {
                state: 'error',
                // instanceId: instanceId,
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
                    _this.emit('aws-instance', {
                      state: 'error',
                      // instanceId: instanceId,
                      errorReason: 'Unable to get IP',
                      details: err,
                    });
                    cb(err);
                    return;
                  }

                  var ip = data.Reservations[0].Instances[0].PublicIpAddress;

                  _this.emit('aws-instance', {
                    state: 'launched',
                    data: {
                      instanceId: instanceId,
                      ip: ip,
                    },
                  });

                  cb(null, {
                    instanceId: instanceId,
                    ip: ip,
                  });
                }
              );
            }, 1000);
          });
        });
      }).catch(err => {
        console.log('error catched', err);
        cb({
          error: 'unable to setup security group and keypairs',
        });
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
  function startMachine(instanceId, machineConfig, cb) {
    // 1) upload config
    // 2) run service

    Config.getForAccessKey(config.accessKeyId, 'keyName', KEYNAME)
    .then(keyName => {
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
          privateKey: getKeyFilename(keyName), //'/Users/rost/Development/aws/devenv-key.pem',
        }).then(function () {
          console.log('connected');
          tmp.file(function (err, path, fd, cleanup) {
            console.log('tmp file created');

            fs.writeFile(path, JSON.stringify(machineConfig), function (err) {
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
                  status: 'configuring',
                });
                ssh.putFile(path, 'config.json').then(function () {
                  //
                  cleanup();

                  console.log('upload done');
                  lib.emit('instance', {
                    instance: instance,
                    status: 'starting',
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
        }, (err) => {
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
    });
  }

}

AwsConnection.prototype.__proto__ = EventEmitter.prototype;

module.exports = AwsConnection;
