window.onload = () => {
    'use strict';

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: '.' }).then(function(reg) {
          // Registrierung erfolgreich
          console.log('Registrierung erfolgreich. Scope ist ' + reg.scope);
        }).catch(function(error) {
          // Registrierung fehlgeschlagen
          console.log('Registrierung fehlgeschlagen mit ' + error);
        });
    };
}

let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let mainViewContainer = document.getElementById('mainView');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');


connectButton.addEventListener('click', function() {
  navigator.vibrate(1000);
  connect();
});


disconnectButton.addEventListener('click', function() {
  disconnect();
});


sendForm.addEventListener('submit', function(event) {
  event.preventDefault(); //
  send(inputField.value); //
  inputField.value = '';  //
  inputField.focus();     //
});


let deviceCache = null;

let primService = null;
let characteristicCache = null;
let characteristicWrite = null;


let readBuffer = '';


function connect() {
  return (deviceCache ? Promise.resolve(deviceCache) :
      requestBluetoothDevice()).
      then(device => connectDeviceAndCacheCharacteristic(device)).
      then(characteristic => startNotifications(characteristic)).
      catch(error => log(error));
}


function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['6e400001-c352-11e5-953d-0002a5d5c51b']  
    //filters: [{services: [0x0001]}],
  }).
      then(device => {
        log('"' + device.name + '" bluetooth device selected');
        deviceCache = device;
        deviceCache.addEventListener('gattserverdisconnected',
            handleDisconnection);

        return deviceCache;
      });
}


function handleDisconnection(event) {
  let device = event.target;

  log('"' + device.name +
      '" bluetooth device disconnected, trying to reconnect...');

  connectDeviceAndCacheCharacteristic(device).
      then(characteristic => startNotifications(characteristic)).
      catch(error => log(error));
}


function connectDeviceAndCacheCharacteristic(device) {
  if (device.gatt.connected && characteristicCache) {
    return Promise.resolve(characteristicCache);
  }

  log('Connecting to GATT server...');

  return device.gatt.connect().
      then(server => {
        log('GATT server connected, getting service...');

        return server.getPrimaryService('6e400001-c352-11e5-953d-0002a5d5c51b');
      }).
      then(service => {
        log('Service found, getting characteristic...');
        primService = service;
        return primService.getCharacteristic('6e400002-c352-11e5-953d-0002a5d5c51b');
      }).
      then(characteristic => {
        log('Characteristic write found');
        characteristicWrite = characteristic;

        return primService.getCharacteristic('6e400003-c352-11e5-953d-0002a5d5c51b');
      }).
      then(characteristic => {
        log('Characteristic notify found');
        characteristicCache = characteristic;
        return characteristicCache;
      });
}


function startNotifications(characteristic) {
  log('Starting notifications...');

  return characteristic.startNotifications().
      then(() => {
        log('Notifications started');
        characteristic.addEventListener('characteristicvaluechanged',
            handleCharacteristicValueChanged);
      });
}


function handleCharacteristicValueChanged(event) {
    //alert(JSON.stringify(event, null, 4));
    //console.log(event.target.value.buffer.byteLength);
    //console.log(event.target.value.buffer);
    //let temp = new Int16Array(event.target.value.buffer, 1, 1);
    let z = new Int8Array(event.target.value.buffer, 1, event.target.value.buffer.byteLength-1);
    let temp = z[1]*256 + z[0];
    //console.log(z);
    //let value = new TextDecoder('iso-8859-2').decode(z);
    //console.log(value);
    //receive(temp);

    let htm = parseFloat(temp/10).toFixed(1) + " °C";
    if(z[2] > 0 && z[3] > 0){
      htm += "<div id='myProgress'> <div id='myBarRed' style='width: "+z[2]+"%;'>"+z[2]+"% </div> </div>";
    }else if(z[2] > 0 && z[4] > 0){
      htm += "<div id='myProgress'> <div id='myBarBlue' style='width: "+z[2]+"%;'>"+z[2]+"% </div> </div>";
    }

    mainViewContainer.innerHTML = htm;//parseFloat(temp/10).toFixed(1) + " °C";
  /*for (let c of value) {
    if (c === '\n') {
      let data = readBuffer.trim();
      readBuffer = '';

      if (data) {
        receive(data);
      }
    }
    else {
      readBuffer += c;
    }
  }*/
}


function receive(data) {
  log(data, 'in');
}


function logToHtml(data, type = '') {
  terminalContainer.insertAdjacentHTML('beforeend',
      '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
}

function log(data, type = '') {
  console.log(data);
}


function disconnect() {
  if (deviceCache) {
    log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
    deviceCache.removeEventListener('gattserverdisconnected',
        handleDisconnection);

    if (deviceCache.gatt.connected) {
      deviceCache.gatt.disconnect();
      log('"' + deviceCache.name + '" bluetooth device disconnected');
    }
    else {
      log('"' + deviceCache.name +
          '" bluetooth device is already disconnected');
    }
  }

  if (characteristicCache) {
    characteristicCache.removeEventListener('characteristicvaluechanged',
        handleCharacteristicValueChanged);
    characteristicCache = null;
  }

  deviceCache = null;
}

function httpGet(theUrl)
{
    var xmlHttp = new XMLHttpRequest();
    
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}


function send(data) {
  data = String(data);

  console.log(httpGet('https://www.google.de'));



  if (!data || !characteristicWrite) {
    return;
  }

  //data += '\n';

  /*if (data.length > 20) {
    let chunks = data.match(/(.|[\r\n]){1,20}/g);

    writeToCharacteristic(characteristicWrite, chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      setTimeout(() => {
        writeToCharacteristic(characteristicWrite, chunks[i]);
      }, i * 100);
    }
  }
  else {*/
    writeToCharacteristic(characteristicWrite, data);
  //}

  log(data, 'out');
}


function writeToCharacteristic(characteristic, data) {
    let databuff =  new TextEncoder().encode(data);
    let payload = new Uint8Array(databuff.length + 1);
    payload.fill(1);
    //payload.set(1,0);
    payload.set(databuff, 1);
    console.log(payload);
    characteristic.writeValue(payload);
}