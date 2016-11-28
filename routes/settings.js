var express = require('express');
var router = express.Router();

var User = require('../models/user');
var Settings = require('../models/settings');

router.get('/', (req, res) => {
  Settings.findOne({ login: req.user.login })
    .then(doc => {
      if (doc) {
        res.json(JSON.parse(doc.settings));
      } else {
        res.json({ error: 'no settings' });
      }
    });
});

router.post('/', (req, res) => {
  var settings = req.body.settings;

  Settings.update(
    { login: req.user.login },
    { login: req.user.login, settings: settings },
    { upsert: true },
    (err, d) => {
      console.log('updated settings');
      res.end();
    }
  );

});

module.exports = router;
