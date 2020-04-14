'use strict';
 
var pkg = require('../package.json');
var Greenlock = require('greenlock');
var greenlock = Greenlock.create({
    configDir: './greenlock.d/config.json',
    maintainerEmail: 'kvizdos@gmail.com'
});
 
greenlock.manager
    .defaults({
        agreeToTerms: true,
        subscriberEmail: 'kvizdos@gmail.com'
    })
    .then(function(fullConfig) {
        // ...
    });