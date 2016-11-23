var userSessions = [];

function getByToken(token) {
  var result = userSessions.find(
    x => x.token === token
  );
  if (result) {
    return result.session;
  } else {
    return null;
  }
}

function createNewUserSession(token) {
  var session = new UserSession();
  userSessions.push({
    token: token,
    session: session,
  });
  return session;
}

function UserSession() {
  var clients = [];
  var uiSockets = [];

  this.getClients = getClients;
  this.getClientStates = getClientStates;
  this.getClientById = getClientById;
  this.addClient = addClient;
  this.removeClient = removeClient;

  this.addUiSocket = addUiSocket;
  this.removeUiSocket = removeUiSocket;
  this.emitOnUi = emitOnUi;

  function getClients() {
    return clients;
  }

  function getClientStates() {
    return clients.map(c => c.client.getStateObject());
  }

  function getClientById(id) {
    return clients.find(client => client.id == id).client;
  }

  function addClient(client) {
    clients.push({
      id: client.id,
      client: client,
    });
  }

  function removeClient(client) {
    clients.splice(clients.indexOf(client), 1);
  }

  function addUiSocket(socket) {
    uiSockets.push(socket);
  }

  function removeUiSocket(socket) {
    if (uiSockets.indexOf(socket) !== -1) {
      uiSockets.splice(uiSockets.indexOf(socket), 1);
    }
  }

  function emitOnUi(event, data) {
    uiSockets.forEach(s => {
      s.emit(event, data);
    });
  }
}

module.exports = {
  getByToken: getByToken,
  createNewUserSession: createNewUserSession,
  UserSession: UserSession,
};
