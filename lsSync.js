var fs = require('fs');
var path = require('path');

const pwd = 'src/';

module.exports = function walkSync(dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    var filepath = path.join(dir, file);
    var stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      filelist.push({
        name: filepath.replace(pwd, ''),
        size: stats.size,
        mtime: stats.mtime,
      });
    }
  });

  return filelist;
};
