const _CONF = require('../config');

var proxy = require('redbird')({port: _CONF.ports.proxy, bunyan: process.env.PROXYLOGS || false, secure: true, ssl: {
    http2: true,
    port: 443
}, letsencrypt: {
    path: __dirname + "/certs",
    port: 9999    
}});

let _REDIS;
let _AUTH;

try {
    _REDIS = new (require('../db/redis'))();
    _AUTH = new (require('../auth/confirmAuth'))(_REDIS);
} catch (err) {
    console.log(err);
}
var http = require('http');

const _MongoConfig = require('../db/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;

var urls = require('url');

http.createServer(function (req, res) {
    var goTo = (req.url.slice(1, -1) || "");
    res.writeHead(302, {
        'Location': _CONF.createURL("auth") + (goTo !== "" ? "?go=" + goTo : "")
      });
    res.end();
}).listen(_CONF.ports.unauthed, () => console.log("Unauth Redirect Server Started"));

http.createServer((req, res) => {
    res.write("DONE");
    res.end();
}).listen(8084)

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

    const mainApp = req.headers.host.split(".")[0]

    const cookies = parseCookies(req);

    const t1 = new Date();

    if(mainApp == "unauthed" || mainApp == "auth") {
        return null;
    } else {
        return new Promise((resolve, reject) => { 
            if(mainApp == "unauthed" || mainApp == "auth") {resolve(true)} else {

                _AUTH.authenticate(cookies.kvToken, mainApp).then(authed => {
                    if(authed) {
                        resolve(null);
                    } else {
                        resolve("http://127.0.0.1:" + _CONF.ports.unauthed);
                    }

                    const t2 = new Date();
                    // in case I want to log this eventually
                    let authTime = (t2 - t1) / 1000
                })
            }
        });
    }
}

confirmAuth.priority = 200;
proxy.addResolver(confirmAuth);

proxy.register("auth.home.kentonvizdos.com", "127.0.0.1:" + _CONF.ports.auth);
proxy.register("unauth.home.kentonvizdos.com", "127.0.0.1:" + _CONF.ports.unauthed);
proxy.register("home.kentonvizdos.com", "127.0.0.1:" + _CONF.ports.dashboard);

const registerSaved = () => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        dbo.collection("applications").find({}).toArray(function(err, result) {
            if (err) throw err;

            for(p of result) {
                console.log(`Loaded ${p.name} (${p.shortName}) on port ${p.port} (requires authentication: ${p.requiresAuthentication})`);
                _REDIS.set(`APP:${p.shortName}`, JSON.stringify({requiresAuth: p.requiresAuthentication}));
                proxy.register(_CONF.createURL(p.shortName, true), "127.0.0.1:" + p.port);

            }
        });
    });
}

registerSaved();

console.log(`Proxy Server Started (Redis ${_AUTH.id})`)

// module.exports.add = function(sub, port) {
//     proxy.register(sub + ".home.kentonvizdos.com", "http://portabeast:" + port);

// };

module.exports = {
    
    add: (sub, port, requireAuthentication) => {
        _REDIS.set(`APP:${sub}`, JSON.stringify({requiresAuth: requireAuthentication}));
        proxy.register(_CONF.createURL(sub, true), "127.0.0.1:" + port);
    }
}