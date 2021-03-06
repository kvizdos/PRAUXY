// Install body-parser and Express
const express = require('express')
const app = express()
var http = require('http').createServer(app);
var io = require('socket.io')(http);


var bodyParser = require('body-parser')
var multer  = require('multer');
var fs = require("fs");

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;

const _LOGGER = require('../helpers/logging');

const _REDIS = new (require('../helpers/redis'))();
const _AUTH = new (require('../auth/confirmAuth'))(_REDIS);
const _PM = require('../proxy/proxy');
const _AUTHMODULE = require("../auth/auth");
      _AUTHMODULE.dashboardSocket = io;

module.exports.auth = _AUTHMODULE.http
module.exports.dash = http;
module.exports.proxy = _PM;

const _SITELAUNCHER = new (require("../sites/launcher"))();

const _MONITOR = require('../monitoring/monitor')();

const _CONF = require('../config');


// Use req.query to read values!!
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const storage = multer.diskStorage({ // notice you are calling the multer.diskStorage() method here, not multer()
    destination: function(req, file, cb) {
        cb(null, 'tmp/')
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname)
    }
});
var upload = multer({ storage })

function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

function confirmParams(params) {
    const filtered = params.filter(Boolean);
    return filtered.length == params.length;
}

app.use('/assets', express.static("./dashboard/frontend/assets"));
app.use('/sw.js', express.static(`./dashboard/frontend/sw.js`));

/**
 * Retrieve all of a users applications
 * 
 * @return {Object[]} - All apps
 */
app.get('/api/all', (req, res) => {
    const cookies = parseCookies(req);
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        dbo.collection("applications").find({ $or: [ { group: { $lte: parseInt(cookies.prauxyToken.split(":")[2]) } }, { users: { $in: [cookies.prauxyToken.split(":")[1]] } }]}).toArray(function(err, result) {
            if (err) throw err;
            res.json(result);
            db.close();
        });
    });
})

/**
 * Generates a new application for a user
 * 
 * @param {string} req - name, shortName, file, port, ra, image, customURL
 */
app.post('/api/new', upload.single('icon'), (req, res) => {
    if(!_AUTH.isAdmin(req, res)) { return res.status(401).json({reason: "level not high enough"}); }

    const cookies = parseCookies(req);
    const createdGroup = parseInt(cookies.prauxyToken.split(":")[2]);

    const name = req.body.name;
    const shortName = req.body.short;
    const isImage = req.file ? true : false;
    const port = req.body.port;
    const requiresAuthentication = req.body.ra !== undefined && req.body.ra == "on" ? true : false;
    const image = req.file ? req.file.originalname : "NO IMAGE";
    const customURL = req.body.customurl;

    const newApp = {name: name, image: image, shortName: shortName, isImage: isImage, port: port, requiresAuthentication: requiresAuthentication, customURL: customURL == "" ? "" : customURL, users: [], group: createdGroup};
    var file = __dirname + '/frontend/assets/apps/' + image;

    if(!confirmParams([name, shortName, port])) {
        return res.status(400).send("invalid params")
    }

    if(req.file) fs.renameSync(req.file.path, file);

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

        dbo.collection("applications").insertOne(newApp, function(err, result) {
            if (err) throw err;

            _PM.add(shortName, port, requiresAuthentication, customURL);

            res.redirect(_CONF.createURL());
            db.close();
        });
    });
    
})

app.post('/api/update', _AUTH.isAdmin, (req, res) => {
    const name = req.body.name;
    const lvl = req.body.lvl;
    const users = req.body.users;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

        dbo.collection("applications").updateOne({name: name}, {$set: { group: parseInt(lvl), users: users != "no-users-added" ? users.split(", ") : [] }}, function(err, result) {
            if (err) throw err;

            res.json({status: "complete"})
            db.close();
        });
    });
})

app.get("/*", (req, res) => {
    res.sendFile("./dashboard/frontend/index.html", {root: "./"})
})

io.on('connection', (socket) => {
    const date = new Date((+ new Date));

    socket.on('connection', (username, cb) => {
        socket.join(username);

        socket.broadcast.emit('alert', {msg: username + " connected", time: `${(date.getHours() > 12 ? date.getHours() - 12 : date.getHours())}:${("0" + date.getMinutes()).substr(-2)} a ${date.getHours() > 12 ? "PM" : "AM"}`,type: 'user'})
        _REDIS.get(`AUTHTFA:${username}`).then((key) => {
            if(key) {
                const tfaNum = key.split(":")[1];

                const tfa1 = Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
                const tfa2 = tfa1 != tfaNum && Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
                const tfa3 = tfa1 != tfaNum && tfa2 != tfaNum ? tfaNum : Math.floor(Math.random() * 100) + 1;
                cb(tfa1, tfa2, tfa3);
            }
        })
    })

    socket.on('checkTFA', (username, tfa, cb) => {
        _REDIS.get(`AUTHTFA:${username}`).then((val) => {
            if(val) {
                let sendToSocket = val.split(":")[0];
                let correctTFA = val.split(":")[1];
                if(correctTFA == tfa) {
                    

                    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                        if (err) throw err;
                        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
                        dbo.collection("users").findOne({username: username}, function(err, result) {

                            _REDIS.get(`AUTHTOKEN:${username}`).then(token => {
                                if(token) {
                                    _AUTHMODULE.authSocket.to(sendToSocket).emit('login', {authenticated: true, token: token, group: result.group});
                                    _REDIS.remove(`AUTHTFA:${username}`);
                                    cb(true)

                                    dbo.collection("users").updateOne({username: username}, {$set: {loggedIn: true, lastLogin: + (new Date)}}, (err, result) => {                        
                                        if(err) _LOGGER.warn(err, "Authorization");
                                        db.close();
                                    });
                                } else {
                                    cb(false)
                                }
                            });
                        });
                    });
                } else {
                    _AUTHMODULE.resetTFA(username, sendToSocket);
                    cb(false)
                }
            } else {
                cb(false)
            }
        })
    })
})

try {
    // if(process.env.NODE_ENV != "test") {
        http.listen(_CONF.ports.dashboard, (err) =>{ 
            if(err) throw err;
            _LOGGER.log(`Started`, "Dashboard")
        })
    // } else {
    // }
} catch(err) {
    _LOGGER.error(err, "Dashboard");
}