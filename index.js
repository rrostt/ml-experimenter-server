var fs = require('fs');
var path = require('path');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var socketio = require('socket.io');
var io = socketio(server);
var lsSync = require('./lsSync');
var bodyParser = require('body-parser');
var aws = require('./aws');
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var config = require('./config');

var UserSessions = require('./userSessions');

var fileRoute = require('./routes/file');
var machinesRoute = require('./routes/machines');
var awsRoute = require('./routes/aws');
var authRoute = require('./routes/auth');
var settingsRoute = require('./routes/settings');
var projectsRoute = require('./routes/projects');

require('mongoose').connect('mongodb://mongo/mle');

var User = require('./models/user');

var Client = require('./worker-client.js');

app.use(express.static('public'));

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, authorization'
  );
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// capture jwt and accessToken
app.use(function (req, res, next) {
  if (req.headers && req.headers.authorization) {
    var parts = req.headers.authorization.split(' ');
    if (parts.length == 2) {
      var scheme = parts[0];
      var credentials = parts[1];

      req.jwt = credentials;
      req.body.accessToken = req.jwt;
    }
  }

  next();
});

app.use(expressJwt({ secret: config.jwtSecret, credentialsRequired: false }));

// check jwt and get usersession
app.use(function (req, res, next) {
  if (req.jwt) {
    var userSession = UserSessions.getByLogin(req.user.login);
    req.userSession = userSession;

    User.findOne({ login: req.user.login })
    .then(user => {
      req.user = user;
      next();
    });
  } else {
    next();
  }
});

function requireUserSession(req, res, next) {
  if (!!req.user) {
    next();
  } else {
    res.json({ noauth: true, error: 'not logged in' });
  }
}

app.get('/', function (req, res) {
  res.send('hello');
});

app.get('/files', requireUserSession, function (req, res) {
  res.json(lsSync(req.user.getDir()));
});

app.use('/settings', settingsRoute);
app.use('/auth', authRoute);
app.use('/file', requireUserSession, fileRoute);
app.use('/machines', requireUserSession, machinesRoute);
app.use('/aws', requireUserSession, awsRoute);
app.use('/projects', requireUserSession, projectsRoute);

server.listen(1234);

io.on('connection', function (socket) {
  var userSession;
  var client; // if this connection is a client

  console.log('connected client');

  socket.on('worker-connected', (state) => {
    var login;
    try {
      var jwtData = jwt.verify(state.accessToken, config.jwtSecret);
      login = jwtData.login;
    } catch (e) {
      console.log('INVALID access token. jwt unable to verify token.');
      return;
    }

    console.log('worker trying to connect', state, login);
    userSession = UserSessions.getByLogin(login);
    if (!userSession) {
      userSession = UserSessions.createNewUserSession(state.accessToken, login);
    }

    User.findOne({ login: login }).then(user => {
      try {
        console.log('new worker connected', user); //, clients.length);
        client = new Client(socket, state, user);
        userSession.addClient(client);
        userSession.emitOnUi('machines', userSession.getClientStates());

        client.on('change', () => {
          console.log('change happened'); //, uiSockets.length);
          userSession.emitOnUi('machine-state', client.getStateObject());
        });

        client.on('dataset-changed', (data) => {
          userSession.emitOnUi('dataset-changed', data);
        });
      } catch (e) {
        console.log('something', e);
      }
    });
  });

  socket.on('ui-connected', (accessToken) => {
    console.log('ui connecting', accessToken);

    var login;
    try {
      var jwtData = jwt.verify(accessToken, config.jwtSecret);
      login = jwtData.login;
    } catch (e) {
      console.log('INVALID access token. jwt unable to verify token.', e);
      return;
    }

    userSession = UserSessions.getByLogin(login);
    if (!userSession) {
      userSession = UserSessions.createNewUserSession(accessToken, login);
    }

    userSession.addUiSocket(socket);

    socket.emit('machines', userSession.getClientStates());
  });

  socket.on('disconnect', function () {
    console.log('client disconnected');
    if (!userSession) {
      console.log('no usersession found. odd.');
      return;
    }

    if (client !== undefined) {
      userSession.removeClient(client);
      userSession.emitOnUi('machines', userSession.getClientStates());
    } else {  // it must be a uiSocket if anything
      userSession.removeUiSocket(socket);
    }
  });
});
