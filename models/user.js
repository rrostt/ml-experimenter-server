var mongoose = require('mongoose');

var UserSchema = mongoose.Schema({ login: String, password: String });
var User = mongoose.model('user', UserSchema);

module.exports = User;
