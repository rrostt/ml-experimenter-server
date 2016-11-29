var fs = require('fs');
var express = require('express');
var router = express.Router();
var appConfig = require('../config.json');
var jwt = require('jsonwebtoken');

var config = require('../config');

var UserSessions = require('../userSessions');
var User = require('../models/user');

router.post('/login', (req, res) => {
  console.log('login');

  var login = req.body.login;
  var password = req.body.password;

  User.findOne({ login: login, password: password }).then(
    (user) => {
      if (user) {
        var accessToken = jwt.sign({ login: login }, config.jwtSecret);
        session = {
          login: login,
          accessToken: accessToken,
        };

        var userSession = UserSessions.getByLogin(login);
        if (!userSession) {
          userSession = UserSessions.createNewUserSession(accessToken, login);
          console.log('created user session');
        }

        res.json(session);

        user.verifySetup();
      } else {
        res.json({ error: 'wrong credentials' });
      }
    }, (err) => {
      res.json({ error: 'error connecting to db' });
    }
  );

});

module.exports = router;
