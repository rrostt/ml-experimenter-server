var fs = require('fs');
var express = require('express');
var router = express.Router();
var appConfig = require('../config.json');
var jwt = require('jsonwebtoken');

var User = require('../models/user');

var sessions = [];

router.post('/login', (req, res) => {
  console.log('login');

  var login = req.body.login;
  var password = req.body.password;

  User.findOne({ login: login, password: password }).then(
    (user) => {
      if (user) {
        var session = sessions.find((session) => session.login === login);
        if (!session) {
          var accessToken = jwt.sign({ login: login }, 's3cr3t');
          session = {
            login: login,
            accessToken: accessToken,
          };

          sessions.push(session);
        }

        res.json(session);
      } else {
        res.json({ error: 'wrong credentials' });
      }
    }, (err) => {
      res.json({ error: 'error connecting to db' });
    }
  );

});

module.exports = router;
