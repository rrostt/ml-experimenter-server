var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var db = mongoose.connect('mongodb://mongo/mle');
var User = require('./models/user');

var bcrypt = require('bcrypt');

var name = process.argv[2];
var pass = process.argv[3];

var overwriteExisting = true;
var creatingNew = false;

bcrypt.hash(pass, 5, (err, hash) => {

  User.findOne({ login: name }, (err, user) => {
    if (user) {
      console.log('user already exists');

      if (!overwriteExisting) {
        db.disconnect();
        return;
      } else {
        console.log('setting password for existing user');
        user.password = hash;
      }
    } else {
      user = new User({ login: name, password: hash });
      creatingNew = true;
    }

    user.save((err, user) => {
      db.disconnect();

      if (err) {
        console.log('unable to save user in database');
      } else if (creatingNew) {
        console.log('user added');
      } else {
        console.log('user password set');
      }
      console.log(hash);
    });
  });
});
