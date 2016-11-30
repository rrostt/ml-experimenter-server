var fs = require('fs-extra');
var path = require('path');
var express = require('express');
var router = express.Router();

var Project = require('../models/project');

router.get('/', (req, res) => {
  Project.allForLogin(req.user.login)
  .then(projects => {
    res.json(projects.map(project => ({
      name: project.name,
    })));
  },

  err => {
    res.json({
      error: 'unable to list projects',
    });
  });
});

router.get('/load/:name', (req, res) => {
  // load project given by name
  // archive current project
  // then load
  if (req.params.name === '__current') {
    Project.getCurrent(req.user.login)
    .then(project => res.json(project));
    return;
  }

  Project.archiveCurrent(req.user.login)
  .then(() => {
    Project.load(req.user, req.params.name)
    .then((project) => {
      res.json(project);
    },

    (err) => {
      console.log('unable to load project', err);
      res.json({
        error: 'unable to load project',
      });
    });
  });
});

router.get('/new', (req, res) => {
  Project.archiveCurrent(req.user.login)
  .then(() => Project.getCurrent(req.user.login))
  .then(() => {
    res.json({});
  })
  .catch(err => {
    console.log('error creating new project', err);
    res.json({
      error: 'unable to create new project',
    });
  });
});

router.post('/rename/:name', (req, res) => {
  if (!(/^[a-zA-Z_-]*$/g.test(req.body.newName))) {
    res.json({ error: 'invalid project name' });
    return;
  }

  Project.findOne({ login: req.user.login, name: req.params.name })
  .then(project => {
    if (project) {
      project.name = req.body.newName;
      project.save(err => {
        if (err) {
          res.json({
            error: 'unable to rename',
          });
        } else {
          res.json({});
        }
      });
    } else {
      res.json({
        error: 'no such project',
      });
    }
  });
});

module.exports = router;