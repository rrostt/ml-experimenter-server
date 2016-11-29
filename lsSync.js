var fs = require('fs');
var path = require('path');

module.exports = function lsSync(cwd) {
  return walkSync(cwd, []);

  function walkSync(dir, filelist) {
    var files = fs.readdirSync(dir);
    files.forEach(function (file) {
      var filepath = path.join(dir, file);
      var stats = fs.statSync(filepath);
      if (stats.isDirectory()) {
        filelist = walkSync(filepath, filelist);
      } else {
        filelist.push({
          name: filepath.replace(cwd, ''),
          size: stats.size,
          mtime: stats.mtime,
        });
      }
    });

    return filelist;
  }
};
