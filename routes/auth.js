var fs = require('fs');
var express = require('express');
var router = express.Router();
var appConfig = require('../config.json');

var sessions = [];

router.post('/login', (req, res) => {
  var login = req.body.login;
  var password = req.body.password;

  var session = sessions.find((session) => session.login === login);
  if (!session) {
    session = {
      login: login,
      accessToken: btoa(login),
    };
  }

  res.json(session);
});

module.exports = router;
