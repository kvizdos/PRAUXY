const _CONF = require('../config');
const _LOGGER = require('../helpers/logging');

const speedtest = require('./speedtest');

const start = () => {
    _LOGGER.log("Started", "Monitor")    

    setInterval(function() {
        _LOGGER.log("Running monitors..", "Monitor")    
        const t = speedtest.getSpeed();
    }, _CONF.monitorLength);
}

module.exports = start;