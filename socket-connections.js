var jwt = require('jsonwebtoken');
var UserSessions = require('./userSessions');
var User = require('./models/user');
var config = require('./config');

var Client = require('./worker-client.js');

function setupNewConnection(socket) {
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
}

module.exports = {
  setupNewConnection: setupNewConnection,
};
