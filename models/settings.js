var mongoose = require('mongoose');

var SettingsSchema = mongoose.Schema({ login: String, settings: String });
var Settings = mongoose.model('settings', SettingsSchema);

Settings.forUser = (login) => (
  new Promise((resolve, reject) => {
    Settings.findOne({ login: login }).then(doc => {
      if (doc) {
        resolve(JSON.parse(doc.settings));
      } else {
        resolve({});
      }
    });
  })
);

module.exports = Settings;
