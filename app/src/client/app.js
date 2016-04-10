//=========================================================
// CFxNES setup
//=========================================================

CFxNES.setLogLevel('all');

var cfxnes = new CFxNES({
  sha1: sha1,
  jszip: JSZip,
  screenfull: screenfull,
  storage: 'browser',
});

cfxnes.loadConfiguration().then(function() {
  cfxnes.setSaveOnClose(true);
  cfxnes.setSavePeriod(60); // sec
}).catch(function(error) {
  console.error('Unable to load CFxNES configuration', error);
});

//=========================================================
// Application state
//=========================================================

var app = riot.observable({
  init: function() {
    this.reset();
    this.load();
  },
  reset: function() {
    this.fpsVisible = true;
    this.controlsVisible = true;
    this.controlsOpened = true;
  },
  load: function() {
    this.fpsVisible = localStorage.getItem('fpsVisible') !== 'false';
    this.controlsVisible = localStorage.getItem('controlsVisible') !== 'false';
  },
  save: function() {
    localStorage.setItem('fpsVisible', this.fpsVisible ? 'true' : 'false');
    localStorage.setItem('controlsVisible', this.controlsVisible ? 'true' : 'false');
  },
  route: function(view, param) {
    app.viewParam = param;
    app.trigger('route', view || 'emulator', param);
  },
  watch: function(events, tag, callback) {
    callback = callback.bind(tag);
    tag.on('mount', this.on.bind(this, events, callback));
    tag.on('unmount', this.off.bind(this, events, callback));
  },
});

app.init();

//=========================================================
// RiotJS setup
//=========================================================

$(document).ready(function() {
  riot.mount('*');
  riot.route(app.route);
  riot.route.start(true); // start + exec
});

//=========================================================
// Utilities
//=========================================================

function eachTag(tags, callback) {
  if (tags != null) {
    if (tags.length == null) {
      callback(tags); // Single tag
    } else {
      tags.forEach(callback);
    }
  }
};

function getErrorMessage(error) {
  if (error.message) {
    return 'Error: ' + error.message; // Error object
  }
  if (error.status) {
    return 'Error: Unable to download file (server response: ' + error.status + ' ' + error.statusText + ').'; // JQuery response
  }
  if (error.status === 0) {
    return 'Error: Unable to connect to server.'; // JQuery response
  }
  return error;
};
