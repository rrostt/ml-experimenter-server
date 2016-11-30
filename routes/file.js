var fs = require('fs-extra');
var path = require('path');
var express = require('express');
var router = express.Router();
var fileUpload = require('express-fileupload');

router.post('/upload', fileUpload(), (req, res) => {
  var files = req.files;

  var cwd = req.user.getDir();

  console.log('files', files);

  var moveFiles = Object.keys(files).map(name => new Promise((resolve, reject) => {
    var file = files[name];

    // replace all non alphanumeric characters with _
    var filename = name.replace(/[^a-z0-9_\.-]/gi, '_');

    file.mv(path.join(cwd, filename), err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  }));
  Promise.all(moveFiles)
  .then(() => {
    res.send({ status: 'ok' });
  }, (err) => {
    console.log('error moving uploaded files', err);
    res.send({ error: 'unable to save files' });
  });
});

router.post('/add', function (req, res) {
  var file = req.body.name;

  var cwd = req.user.getDir();

  var filepath = path.join(cwd, file);
  fs.access(filepath, (err) => {
    if (!err) {
      res.json({
        error: 'File exists',
      });
    } else {
      fs.mkdirs(path.dirname(filepath), () => {
        fs.open(filepath, 'w', (err, f) => {
          if (err) {
            res.json({
              error: 'Unable to create file',
            });
          } else {
            fs.close(f);
            res.json({});
          }
        });
      });
    }
  });
});

router.post('/mv', function (req, res) {
  var fileFrom = req.body.from;
  var fileTo = req.body.to;

  console.log('mv', fileFrom, fileTo);

  var cwd = req.user.getDir();

  var fileFromPath = path.join(cwd, fileFrom);
  var fileToPath = path.join(cwd, fileTo);

  fs.access(fileToPath, (err) => {
    if (err == null || err.errno !== -2) {
      res.json({
        error: 'File already exists',
      });
    } else {
      fs.mkdirs(path.dirname(fileToPath), () => {
        fs.rename(fileFromPath, fileToPath, (err) => {
          if (err) {
            res.json({
              error: 'Unable to rename file',
            });
          } else {
            res.json({});
          }
        });
      });
    }
  });
});

router.post('/rm', function (req, res) {
  var file = req.body.name;

  var cwd = req.user.getDir();

  var filepath = path.join(cwd, file);
  fs.unlink(filepath, (err) => {
    if (err) {
      res.json({
        error: 'Unable to delete file',
      });
    } else {
      res.json({});
    }
  });
});

router.get('/', function (req, res) {
  var file = req.query.name;

  var cwd = req.user.getDir();

  fs.readFile(path.join(cwd, file), (err, content) => {
    res.send('' + content);
  });
});

router.post('/', function (req, res) {
  var file = req.body.name;
  var content = req.body.content;

  var cwd = req.user.getDir();

  fs.writeFile(path.join(cwd, file), content, (err) => {
    if (err) {
      res.json({ error: true });
    } else {
      res.json({ success: true });
    }
  });
});


module.exports = router;
