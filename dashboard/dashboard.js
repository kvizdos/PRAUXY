// Install body-parser and Express
const express = require('express')
const app = express()

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
const _AUTHMODULE = require('../auth/auth');

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

app.use('/assets', express.static("./dashboard/frontend/assets"));

app.get('/api/all', (req, res) => {
    const cookies = parseCookies(req);
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("homerouter");
        dbo.collection("applications").find({ $or: [ { group: { $lte: parseInt(cookies.kvToken.split(":")[2]) } }, { users: { $in: [cookies.kvToken.split(":")[1]] } }]}).toArray(function(err, result) {
            if (err) throw err;
            res.json(result);
            db.close();
        });
    });
})

app.post('/api/new', upload.single('icon'), (req, res) => {
    if(!_AUTH.isAdmin(req, res)) { return; }

    const cookies = parseCookies(req);
    const createdGroup = parseInt(cookies.kvToken.split(":")[2]);

    const name = req.body.name;
    const shortName = req.body.short;
    const isImage = req.file ? true : false;
    const port = req.body.port;
    const requiresAuthentication = req.body.ra !== undefined && req.body.ra == "on" ? true : false;
    const image = req.file ? req.file.originalname : "NO IMAGE";
    const customURL = req.body.customurl;

    const newApp = {name: name, image: image, shortName: shortName, isImage: isImage, port: port, requiresAuthentication: requiresAuthentication, customURL: customURL == "" ? "" : customURL, users: [], group: createdGroup};
    var file = __dirname + '/frontend/assets/apps/' + image;

    if(req.file) fs.renameSync(req.file.path, file);

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("homerouter");

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
        var dbo = db.db("homerouter");

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

try {
    app.listen(_CONF.ports.dashboard, (err) =>{ 
        if(err) throw err;
        _LOGGER.log(`Started`, "Dashboard")
    })
} catch(err) {
    _LOGGER.error(err, "Dashboard");
}