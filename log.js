var config = require('config');
var log4js = require('log4js');
log4js.configure(config.get("log"));
