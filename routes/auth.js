var fs = require('fs');
var express = require('express');
var router = express.Router();
var appConfig = require('../config.json');
var jwt = require('jsonwebtoken');

// var users = require('../user');

var sessions = [];

router.post('/login', (req, res) => {
  console.log('login');

  var login = req.body.login;
  var password = req.body.password;

  var session = sessions.find((session) => session.login === login);
  if (!session) {
    var accessToken = jwt.sign({ accessToken: login }, 's3cr3t');
    session = {
      login: login,
      accessToken: accessToken,
    };

    sessions.push(session);
  }

  res.json(session);
});

module.exports = router;
