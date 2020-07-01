const _CONF = require('../config');
const _LOGGER = require('../helpers/logging');

var proxy = require('redbird')({port: _CONF.ports.proxy, 
    bunyan: false
});

/*const sslParams = {
		letsencrypt: {
			email: "kvizdos+letsencrypt@gmail.com",
			production: false
		}
	}
*/
//, bunyan: process.env.PROXYLOGS || false

let _REDIS;
let _AUTH;

try {
    _REDIS = new (require('../helpers/redis'))();
    _AUTH = new (require('../auth/confirmAuth'))(_REDIS);
} catch (err) {
    _LOGGER.error(err, "Proxy");
}
var http = require('http');

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;

let registered = [];

http.createServer(function (req, res) {
    var goTo = (req.url.slice(1, -1) || "");
    if(goTo = "das") goTo = "";
    
    res.writeHead(302, {
        'Location': _CONF.createURL("auth") + (goTo !== "" ? "?go=" + goTo : "")
      });
    res.end();
}).listen(_CONF.ports.unauthed, () => _LOGGER.log("Started", "Unauth Server"));

http.createServer((req, res) => {
    res.write("DONE");
    res.end();
}).listen(_CONF.ports.pageNotFound, () => _LOGGER.log("Started", "404 Server"));




function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

const confirmAuth = (host, url, req) => {
    if(req.headers.host == undefined) {
        return new Promise((resolve, reject) => {
            resolve(false);
        })
    }


    const base = escape(_CONF.baseURL);
    const regex = new RegExp(base.replace(/\./g, '\\.'), 'g');

    let mainApp = req.headers.host;

    const isNotCustom = regex.test(req.headers.host);

    if(isNotCustom) {
        mainApp = req.headers.host.split(".")[0];
    }

    const cookies = parseCookies(req);

    const t1 = new Date();

    if(mainApp == "unauthed" || mainApp == "auth") {
        return null;
    } else {
        return new Promise((resolve, reject) => { 
            if(mainApp == "unauthed" || mainApp == "auth" || mainApp == "sites") {resolve(true)} else {
                _AUTH.authenticate(cookies.prauxyToken, mainApp).then(authed => {
                    if(authed) {
                        resolve(null);
                    } else {
                        _LOGGER.warn(`Unauthorized User attempted to access ${mainApp.toUpperCase() + " service" || "a service"}`, "Authorization");
                        resolve("http://127.0.0.1:" + _CONF.ports.unauthed);
                    }
                })
            }
        });
    }
}


confirmAuth.priority = 200;

proxy.addResolver(confirmAuth);

proxy.register(_CONF.createURL('auth', true), "127.0.0.1:" + _CONF.ports.auth);

proxy.register(_CONF.createURL('unauth', true), "127.0.0.1:" + _CONF.ports.unauthed);

proxy.register(_CONF.createURL('sites', true), "127.0.0.1:" + _CONF.ports.siteLauncher);

proxy.register(_CONF.createURL('', true), "127.0.0.1:" + _CONF.ports.dashboard);

proxy.register("127.0.0.1", "127.0.0.1:" + _CONF.ports.dashboard);

registered.push(...["auth", "unauthed", "home"]);

const registerSaved = () => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        dbo.collection("applications").find({}).toArray(function(err, result) {
            if (err) throw err;

            for(p of result) {
                if(p.customURL == undefined || p.customURL == "") {
                    _LOGGER.log(`Started on port ${p.port} (requires authentication: ${p.requiresAuthentication})`, p.name + " (" + p.shortName + ")");
                    _REDIS.set(`APP:${p.shortName}`, JSON.stringify({requiresAuth: p.requiresAuthentication}));
                    proxy.register(_CONF.createURL(p.shortName, true), p.port.toString().indexOf(":") > 0 ? p.port : "127.0.0.1:" + p.port);
                    registered.push(p.shortName)
                } else {
                    _LOGGER.log(`Started (${p.shortName}) on port ${p.port} (customURL: ${p.customURL}, requires authentication: ${p.requiresAuthentication})`, p.name + " (" + p.shortName + ")");
                    _REDIS.set(`APP:${p.customURL}`, JSON.stringify({requiresAuth: p.requiresAuthentication}));
                    proxy.register(p.customURL, p.port.toString().indexOf(":") > 0 ? p.port : "127.0.0.1:" + p.port);
                }
            }
        });
    });
}

registerSaved();


//proxy.register('*', "127.0.0.1:" + _CONF.ports.pageNotFound);

_LOGGER.log(`Started (Redis ${_AUTH.id})`, "Proxy")

module.exports = {
    
    add: (sub, port, requireAuthentication, customURL = "") => {
        if(customURL == "") {
            _REDIS.set(`APP:${sub}`, JSON.stringify({requiresAuth: requireAuthentication}));
            proxy.register(_CONF.createURL(sub, true), port.toString().indexOf(":") > 0 ? port : "127.0.0.1:" + port);
        } else {
            _REDIS.set(`APP:${customURL}`, JSON.stringify({requiresAuth: requireAuthentication}));
            proxy.register(customURL, port.toString().indexOf(":") > 0 ? port : "127.0.0.1:" + port);
        }
    }
}
