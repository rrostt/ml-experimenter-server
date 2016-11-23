var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var socketio = require('socket.io');
var io = socketio(server);
var path = require('path');
var lsSync = require('./lsSync');
var bodyParser = require('body-parser');
var aws = require('./aws');

var UserSessions = require('./userSessions');

var fileRoute = require('./routes/file');
var machinesRoute = require('./routes/machines');
var awsRoute = require('./routes/aws');
var authRoute = require('./routes/auth');

var Client = require('./worker-client.js');

const pwd = 'src/';

//
// on http enpoints expect user token
//
// create UIs and set of clients per user
// when ui connects on socketio, await auth that identifies user and then add to users ui sokets
// when worker connects expect user-token in state
//

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  req.body.accessToken = 'ask4it';

  if (req.body.accessToken) {
    var userSession = UserSessions.getByToken(req.body.accessToken);
    req.userSession = userSession;
  }

  next();
});

app.get('/', function (req, res) {
  res.send('hello');
});

app.get('/files', function (req, res) {
  res.json(lsSync(pwd));
});

app.use('/auth', authRoute);
app.use('/file', fileRoute);
app.use('/machines', machinesRoute);
app.use('/aws', awsRoute);

server.listen(1234, 'localhost');

// var uiSockets = [];
// var clients = machinesRoute.clients;

// app.uiEmit = function (msg, data) {
//   // uiSockets.forEach(s => {
//   //   s.emit(msg, data);
//   // });
// };
//
// aws.on('aws-instance', (data) => {
//   console.log('aws', data);
// });
//
// aws.on('instance', (data) => {
//   console.log('aws instance event', data);
//   app.uiEmit('aws', data);
// });

io.on('connection', function (socket) {
  var userSession;
  var client; // if this connection is a client

  console.log('connected client');

  socket.on('worker-connected', (state) => {
    console.log('worker', state);
    userSession = UserSessions.getByToken(state.accessToken);
    if (!userSession) {
      userSession = UserSessions.createNewUserSession(state.accessToken);
    }

    console.log('new worker connected'); //, clients.length);
    client = new Client(socket, state);
    userSession.addClient(client);
    userSession.emitOnUi('machines', userSession.getClientStates());

    client.on('change', () => {
      console.log('change happened'); //, uiSockets.length);
      userSession.emitOnUi('machine-state', client.getStateObject());
    });
  });

  socket.on('ui-connected', (accessToken) => {
    userSession = UserSessions.getByToken(accessToken);
    if (!userSession) {
      userSession = UserSessions.createNewUserSession(accessToken);
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
