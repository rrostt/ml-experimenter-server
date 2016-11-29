var fs = require('fs-extra');
var path = require('path');
var mongoose = require('mongoose');

var UserSchema = mongoose.Schema({ login: String, password: String });

UserSchema.methods.getDir = function () {
  return path.join(__dirname, '../data/users/', this.login, 'work/');
};

UserSchema.methods.verifySetup = function () {
  var _this = this;
  return new Promise((resolve, reject) => {
    var cwd = this.getDir();

    console.log('verifying dirs', cwd, _this);

    fs.mkdirs(cwd, (err) => {
      if (err) {
        console.log('error creating directories for user.');
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

var User = mongoose.model('user', UserSchema);

module.exports = User;
