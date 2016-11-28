var mongoose = require('mongoose');

var AwsConfigSchema = mongoose.Schema({ accessKey: String, keyName: String });
var AwsConfig = mongoose.model('aws-config', AwsConfigSchema);

AwsConfig.getForAccessKey = (accessKey, key, defValue = '') => (
  new Promise((resolve, reject) => {
    AwsConfig.findOne({ accessKey: accessKey }).then(
      doc => {
        if (doc) {
          resolve(doc[key] || defValue);
        } else {
          resolve(defValue);
        }
      },

      err => {
        reject(err);
      }
    );
  })
);

AwsConfig.setForAccessKey = (accessKey, key, value) => (
  new Promise((resolve, reject) => {
    var perm = {};
    perm[key] = value;
    AwsConfig.update({ accessKey: accessKey }, perm, { upsert: true }, (err, d) => {
      if (err) {
        console.log('error saving config key', err);
        reject(err);
      } else {
        resolve();
      }
    });
  })
);

module.exports = AwsConfig;
