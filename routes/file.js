var fs = require('fs-extra');
var path = require('path');
var express = require('express');
var router = express.Router();

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
