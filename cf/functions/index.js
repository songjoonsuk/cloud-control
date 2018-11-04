// Firebase Cloud Functions for the Blinky DialogFlow app.
// To deploy: firebase deploy --only functions

const functions = require('firebase-functions');
const {dialogflow} = require('actions-on-google');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

// DialogFlow intents. Note that these do not get configured automatically;
// you must go into the DialogFlow console and add intents with these names
// and corresponding training phrases by hand.
const app = dialogflow();

// Dummy intent for testing.
app.intent('Try me', conv => {
  console.log('Try me intent invoked.');
  conv.ask('You wanted to try me. Okay then.');
});

// Set the given 'elem' on each device  to 'val'.
function setAllDevices(elem, val) {
  var allKeys = [];
  var stripsQuery = admin.database().ref("strips").orderByKey();
  return stripsQuery
    .once("value")
    .then(function(snapshot) {
      console.log('Iterating over all devices');
      snapshot.forEach(function(childSnapshot) {
        var key = childSnapshot.key;
        allKeys.push(key);
      });
    })
    .then(function() {
      allKeys.forEach(function(key) {
        console.log('Setting device ' + key + ' elem ' + elem + ' to ' + val);
          var elemRef = admin.database().ref("strips/" + key + "/" + elem);
          return elemRef
            .set(val)
            .then(function() {
              console.log('Set device ' + key);
            });
        });
      })
      .then(function() {
        console.log('Done setting all devices.');
      });
}

// Return list of {key, value} for each device checkin.
function getDeviceCheckins() {
  var checkins = [];
  var checkinsQuery = admin.database().ref("checkin").orderByKey();
  return checkinsQuery
    .once("value")
    .then(function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        var key = childSnapshot.key;
        var value = childSnapshot.val();
        checkins.push({key: key, value: value});
      });
    })
    .then(function() {
      return checkins;
    });
}

// Return list of {key, value} for device config.
function getDeviceConfigs() {
  var strips = [];
  var stripsQuery = admin.database().ref("strips").orderByKey();
  return stripsQuery
    .once("value")
    .then(function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        var key = childSnapshot.key;
        var value = childSnapshot.val();
        strips.push({key: key, value: value});
      });
    })
    .then(function() {
      return strips;
    });
}

app.intent('Enable all', conv => {
  console.log('Enable all intent invoked.');
  var globals = admin.database().ref("globals");
  return globals.set({
    allEnabled: true
  }).then(function() {
    return setAllDevices('enabled', true)
    .then(function() {
      conv.ask('Okay, all Blinky devices have been enabled.');
    });
  });
});

app.intent('Disable all', conv => {
  console.log('Disable all intent invoked.');
  var globals = admin.database().ref("globals");
  return globals.set({
    allEnabled: false
  }).then(function() {
    return setAllDevices('enabled', false)
    .then(function() {
      conv.ask('Okay, all Blinky devices have been disabled.');
    });
  });
});

app.intent('List devices', conv => {
  console.log('List devices intent invoked.');
  response = 'Here are the Blinky devices that I know about: ';
  var stripsQuery = admin.database().ref("strips").orderByKey();
  return stripsQuery
    .once("value")
    .then(function(snapshot) {
      console.log('Got snapshot for strips.');
      snapshot.forEach(function(childSnapshot) {
        console.log('Adding key ' + childSnapshot.key + ' to response.');
        var key = childSnapshot.key;
        var val = childSnapshot.val();
        if ('name' in val) {
          response += val.name + ', ';
        } else {
          response += 'unnamed with key ' + key + ', ';
        }
      });
    }).then(function() {
      console.log('Responding with: ' + response);
      conv.ask(response);
    });
});

app.intent('Describe', (conv, {deviceName}) => {
  console.log('Describe intent invoked with '+deviceName);
  return getDeviceCheckins().then(function(checkins) {
    console.log('Got ' + checkins.length + ' checkins');
    console.log(checkins);

    var response = "I'm sorry, but I don't know about the device named "
      + deviceName + ". Here is the list of devices I know about: ";
    for (let entry of checkins) {
      var key = entry.key;
      var checkin = entry.value;
      var config = checkin.config;
      if ('name' in config) {
        response += config.name + ', ';
      }
    }
    response += '. ';

    for (let entry of checkins) {
      var key = entry.key;
      var checkin = entry.value;
      var config = checkin.config;
      var ts = checkin.timestamp;
      var d = new Date(ts);

      if (config.name.toLowerCase() == deviceName.toLowerCase()) {
        response = 'Here is the configuration for ' + deviceName +'. ';
        response += deviceName + ' last checked in on ' + d.toDateString() +
          ' at ' + d.toTimeString() + '. ';
        response += deviceName + ' has a MAC address of ' + checkin.mac +
          ' and an IP address of ' + checkin.ip + '. ';
        response += 'Its current RSSI value is ' + checkin.rssi + ' dBm. ';
        if (config.enabled) {
          response += 'This device is enabled. ';
        } else {
          response += 'This device is not enabled. ';
        }
        response += 'Its current mode is ' + config.mode + '. ';
        break;
      }
    }
    conv.ask(response);
  });
});

exports.dialogFlowApp = functions.https.onRequest(app);
