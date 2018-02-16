let Service, Characteristic;
let request = require('request');

const DEFAULT_TIMEOUT = 5000,
  DEFAULT_INTERVAL = 120000; //120s

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-sonoff-th", "SonoffTh", SonoffTh);
};


function SonoffTh(log, config) {
  this.log = log;

  // configuration
  this.url = config["url"];
  this.name = config["name"];
  this.manufacturer = config["manufacturer"] || "Sonoff";
  this.model = config["model"] || "THx";
  this.serial = config["serial"] || "Non-defined serial";
  this.timeout = config["timeout"] || DEFAULT_TIMEOUT;
  this.update_interval = Number(config["update_interval"] || DEFAULT_INTERVAL);

  // variables
  this.last_value = null;
  this.timer = null;
  this.working = false;
}

SonoffTh.prototype = {

  refresh: function () {
    if (this.working) {
      return;
    }
    this.working = true;
    this.last_value = new Promise((resolve, reject) => {
      let ops = {
        uri: this.url, method: "GET", timeout: this.timeout
      };
      request(ops, (error, res, body) => {
        let value = null;
        if (!error) {
          try {
            value = this.fieldName === '' ? body : JSON.parse(body)['humidity'];
            value = Number(value);
            if (value < 0 || value > 100 || isNaN(value)) {
              error = "Got invalid value";
            }
            this.log('Humidity: ' + value);
          } catch (parseErr) {
            error = parseErr.message;
          }
        }
        if (!error) {
          resolve(value);
        } else {
          this.log("Error: " + error);
          reject(error);
        }
        this.working = false;
      });
    }).then((value) => {
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(value, null);
      return value;
    }, (error) => {
      return error;
    });
  },

  getState: function (callback) {
    this.refresh(); //This sets the promise in last_value
    this.last_value.then((value) => {
      callback(null, value);
      return value;
    }, (error) => {
      callback(error, null);
      return error;
    });
  },

  getServices: function () {
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.humidityService = new Service.HumiditySensor(this.name);
    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', this.getState.bind(this));

    if (this.update_interval > 0) {
      this.timer = setInterval(this.refresh.bind(this), this.update_interval);
    }

    return [this.informationService, this.humidityService];
  }
};