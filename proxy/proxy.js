var proxy = require('redbird')({port: 80, bunyan: false});
var http = require('http');

const authenticate = require('../auth/confirmAuth');

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

var urls = require('url');

http.createServer(function (req, res) {
    console.log(req.url)
    var goTo = (req.url.slice(1, -1) || "");

    console.log("GO TO: " + goTo);

    res.writeHead(302, {
        'Location': 'http://auth.home.kentonvizdos.com' + (goTo !== "" ? "?go=" + goTo : "")
        //add other headers here...
      });
    res.end();
}).listen(421);

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
    const mainApp = req.headers.host.split(".")[0]

    const cookies = parseCookies(req);

    if(cookies.kvToken !== undefined || mainApp == "auth") {
        return null;
    } else {
        console.log("HERERERERE - " + (mainApp !== "dash" ? "?go=" + mainApp : ""))
        return "http://localhost:421/" + (mainApp !== "dash" ? mainApp : "");
    }

    // // return null;
    // return mainApp == "auth" ? null : {url: "http://localhost/auth/verify"};
}

confirmAuth.priority = 200;
proxy.addResolver(confirmAuth);

proxy.register("auth.home.kentonvizdos.com", "http://localhost:420");
proxy.register("home.kentonvizdos.com", "http://localhost:8081");

// proxy.register("localhost/auth/login", "http://localhost:420/auth/login");

// proxy.register("code.home.kentonvizdos.com", "http://portabeast:8443");
// proxy.register("guac.home.kentonvizdos.com", "http://portabeast:8080/guacamole");
const registerSaved = () => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        dbo.collection("applications").find({}).toArray(function(err, result) {
            if (err) throw err;

            for(p of result) {
                proxy.register(p.shortName + ".home.kentonvizdos.com", "http://portabeast:" + p.port);

            }
        });
    });
}

registerSaved();

// module.exports.add = function(sub, port) {
//     proxy.register(sub + ".home.kentonvizdos.com", "http://portabeast:" + port);

// };

module.exports = {
    add: (sub, port) => {
        proxy.register(sub + ".home.kentonvizdos.com", "http://portabeast:" + port);
    }
}