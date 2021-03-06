var path = require('path');
var fs = require('fs-extra');
var mongoose = require('mongoose');
var archiver = require('archiver');
var unzip = require('extract-zip');
var git = require('simple-git');

var User = require('./user');

function getArchiveDir(login) {
  return path.join(__dirname, '../data/users/', login, 'archives/');
}

function getArchiveFilename(name) {
  return name.replace(/ /g, '-') + '.zip';
}

var ProjectSchema = mongoose.Schema({ login: String, name: String, archive: String });

ProjectSchema.methods.delete = function () { // for this
  var project = this;

  console.log('deleting project ' + project.name);

  return new Promise((resolve, reject) => {
    User.findOne({ login: project.login }, (err, user) => {
      var cwd = user.getDir();
      var archiveDir = getArchiveDir(project.login);
      var archiveFilename = getArchiveFilename(project.name);
      console.log('deleting file ' + path.join(archiveDir, archiveFilename));
      fs.unlink(path.join(archiveDir, archiveFilename), () => {
        project.remove(err => {
          if (err) {
            console.log('error deleting project in db', err);
          }

          fs.emptyDir(cwd, err => {
            if (err) {
              console.log('error clearing cwd');
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    });
  });
};

var Project = mongoose.model('project', ProjectSchema);

Project.archiveCurrent = login => new Promise((resolve, reject) => {
  Project.getCurrent(login).then(project => {
    if (!project) {
      console.log('no current project');
      resolve();
      return;
    }

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

    console.log('current project ' + project);

    if (project) {
      resolve({
        name: project.name,
      });
    } else {
      resolve(null);
    }
  });
});

Project.createNew = (login) => new Promise((resolve, reject) => {
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
});

Project.load = (user, name) => new Promise((resolve, reject) => {
  console.log('load project', user.login, name);

  Project.findOne({ login: user.login, name: name }, (err, project) => {
    var archivePath = path.join(getArchiveDir(user.login), project.archive);

    console.log('extracing archive into', archivePath, user.getDir());

    //    var extract = unzip.Extract({ path: user.getDir() });
    //    extract.on('close', extractDone);
    //    extract.on('error', extractError);
    //    fs.createReadStream(archivePath).pipe(extract);
    unzip(archivePath, { dir: user.getDir() }, err => {
      if (err) {
        extractError(err);
      } else {
        extractDone();
      }
    });

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

Project.gitClone = (user, url) => new Promise((resolve, reject) => {
  Project.archiveCurrent(user.login)
  .then(() => getUniqueProjectNameFromUrl(url))
  .then(projectName => {
    var project = new Project({
      login: user.login,
      name: projectName,
      archive: '',
    });

    //    nodegit.Clone(url, user.getDir())

    git(user.getDir())
    .clone(url, user.getDir(), (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('repo cloned');
        project.save();
        resolve();
      }
    });
  })
  .catch(err => {
    console.log(err);
  });

  function getUniqueProjectNameFromUrl(url) {
    console.log('getting project name', url);
    var projectName = path.basename(url);

    return checkOrGenerateName(projectName, 0);

    function checkOrGenerateName(projectName, i) {
      console.log('checking name', projectName);
      return new Promise((resolve, reject) => {
        var dirname = projectName + (i > 0 ? '-' + i : '');
        fs.access(path.join(getArchiveDir(user.login), dirname), fs.F_OK, err => {
          if (!err) { // exists
            checkOrGenerateName(projectName, i + 1).then(resolve, reject);
          } else {
            resolve(dirname);
          }
        });
      });
    }
  }
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
