
var config = require('config')
var strg = require("./src/" + config.get('storage.name'))
var noop = function(){}
var path = require('path');
const logger = require('@log4js-node/log4js-api').getLogger("app.index");

require('./log')

strg.once('ready',function(){
    logger.info('Storage Ready.....');
    require("./app.js")
    logger.info('Web API Listening on Port %s .....', config.get("server.port"));
})
strg.init(config.get('storage.options'))