const fs = require('fs');
const path = require('path');
const util = require('util');
const lsSync = require('./lsSync');
const EventEmitter = require('events').EventEmitter;

function Client(socket, initialState, user) {
  var _this = this;

  this.state = Object.assign({}, initialState);

  this.id = this.state.id || new Date().getTime();
  this.stdout = '';
  this.stderr = '';

  const cwd = user.getDir();

  socket.on('state-change', state => {
    Object.assign(_this.state, state);
    _this.emit('change');
  });

  socket.on('data', function (data) {
    console.log('data', data);
  });

  socket.on('stdout', function (data) {
    parseOutput(data);

    console.log('>', data);
    _this.stdout += data;

    _this.stdout = _this.stdout.split('\n').slice(-25).join('\n');

    _this.emit('change');
  });

  socket.on('stderr', function (data) {
    console.log('!', data);
    _this.stderr += data;

    _this.stderr = _this.stderr.split('\n').slice(-25).join('\n');

    _this.emit('change');
  });

  socket.on('fetch', (data) => {
    var count = 0;
    data.forEach((file) => {
      count++;
      fs.readFile(path.join(cwd, file.name), (err, buf) => {
        count--;
        if (err) {
          console.log('error reading file');
        } else {
          var mode = fs.statSync(path.join(cwd, file.name)).mode;
          socket.emit('file', { name: file.name, mode: mode, buf: buf });
        }
      });
    });
  });

  this.getStateObject = () => Object.assign({
    id: _this.id,
    stdout: _this.stdout,
    stderr: _this.stderr,
  }, _this.state);

  this.run = function (cmd) {
    console.log('emitting run');
    socket.emit('run', { cmd: cmd });
  };

  this.stop = function () {
    socket.emit('stop');
  };

  this.sync = function () {
    socket.emit('sync', lsSync(cwd, ['.git']));
  };

  this.clearStdout = () => {
    _this.stdout = '';
    _this.emit('change');

    clearDatasets();
  };

  this.clearStderr = () => {
    _this.stderr = '';
    _this.emit('change');
  };

  function parseOutput(output) {
    var lines = output.split('\n');

    lines.forEach(line => {
      if (!line.startsWith('#')) {
        return;
      }

      var parts = line.split(' ');
      var name = parts[0];
      var values = parts.slice(1);

      addValuesToDataset(name, values);
    });
  }

  var datasets = {};
  function addValuesToDataset(name, values) {
    if (!datasets.hasOwnProperty(name)) {
      datasets[name] = [];
    }

    datasets[name].push(values);

    _this.emit('dataset-changed', { machineId: _this.state.id, name: name, values: datasets[name].slice() });
  }

  function clearDatasets() {
    Object.keys(datasets).forEach(name => {
      datasets[name].splice(0);
      _this.emit('dataset-changed', { machineId: _this.state.id, name: name, values: datasets[name].slice() });
    });
  }
}

util.inherits(Client, EventEmitter);

module.exports = Client;
