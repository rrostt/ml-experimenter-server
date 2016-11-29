var path = require('path');
var fs = require('fs-extra');
var mongoose = require('mongoose');
var archiver = require('archiver');
var unzip = require('unzip');

var User = require('./user');

var ProjectSchema = mongoose.Schema({ login: String, name: String, archive: String });
var Project = mongoose.model('project', ProjectSchema);

function getArchiveDir(login) {
  return path.join(__dirname, '../data/users/', login, 'archives/');
}

function getArchiveFilename(name) {
  return name.replace(/ /g, '-') + '.zip';
}

Project.archiveCurrent = login => new Promise((resolve, reject) => {
  Project.getCurrent(login).then(project => {
    User.findOne({ login: login }, (err, user) => {
      var cwd = user.getDir();
      var archiveDir = getArchiveDir(login);
      var archiveFilename = getArchiveFilename(project.name);
      var archive = archiver('zip');
      var output = fs.createWriteStream(path.join(archiveDir, archiveFilename));
      output.on('close', () => {
        console.log('archive created and saved');
        Project.update(
          {
            login: login,
            name: project.name,
          },
          {
            archive: archiveFilename,
          },
          { upsert: true },
          (err) => {
            if (err) {
              reject(err);
            } else {
              fs.emptyDir(cwd, err => {
                if (err) {
                  console.log('error clearing cwd');
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          }
        );
      });
      output.on('error', reject);

      archive.pipe(output);

      archive.bulk({
        expand: true,
        cwd: cwd,
        src: ['**/*'],
        dot: true,
      });
      archive.finalize();
    });
  });
});

Project.allForLogin = login => new Promise((resolve, reject) => {
  Project.find({ login: login }, (err, projects) => {
    if (err) {
      reject(err);
    } else {
      resolve(projects);
    }
  });
});

Project.getCurrent = (login) => new Promise((resolve, reject) => {
  Project.findOne({ login: login, archive: '' }, (err, project) => {
    if (err) {
      reject(err);
      return;
    }

    if (project) {
      resolve({
        name: project.name,
      });
    } else {
      createNewName(login, 0)
      .then(name => {
        var newProject = new Project({
          login: login,
          name: name,
          archive: '',
        });
        newProject.save((err, d) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              name: name,
            });
          }
        });
      });
    }
  });
});

Project.load = (user, name) => new Promise((resolve, reject) => {
  console.log('load project', user.login, name);

  Project.findOne({ login: user.login, name: name }, (err, project) => {
    var archivePath = path.join(getArchiveDir(user.login), project.archive);

    console.log('extracing archive into', archivePath, user.getDir());

    var extract = unzip.Extract({ path: user.getDir() });
    extract.on('close', extractDone);
    extract.on('error', extractError);
    fs.createReadStream(archivePath).pipe(extract);

    function extractDone() {
      project.archive = '';
      project.save(() => {
        resolve(project);
      });
    }

    function extractError(err) {
      reject(err);
    }
  });
});

function createNewName(login, i) {
  var name = 'newproject';

  if (i > 0) {
    name = name + '-' + i;
  }

  return new Promise((resolve, reject) => {
    var filename = path.join(getArchiveDir(login), getArchiveFilename(name));

    fs.access(filename, fs.F_OK, err => {
      if (!err) { // file exists
        createNewName(login, i + 1).then(resolve, reject);
      } else {
        resolve(name);
      }
    });
  });
}

module.exports = Project;
