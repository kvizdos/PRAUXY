// Install body-parser and Express
const express = require('express')
const app = express()

var bodyParser = require('body-parser')
var multer  = require('multer');
var fs = require("fs");

const _MongoConfig = require('../db/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;

console.log("Dashboard Starting (loading Redis)")

const _REDIS = new (require('../db/redis'))();

console.log("Dashboard Starting (Redis loaded)")

const _AUTH = new (require('../auth/confirmAuth'))(_REDIS);

console.log("Dashboard Starting (Auth loaded)")

const _PM = require('../proxy/proxy');
const _AUTHMODULE = require('../auth/auth');

const _CONF = require('../config');

console.log("Dashboard Starting (Everything lOaded)")

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

app.use('/assets', express.static("./dashboard/frontend/assets"));

app.get("/.well-known/acme-challenge", (req, res) => {
    console.log("EUIORHWOGHRSGHFDOIGNDFOGHNJDFOGJDFIOGJDFIOGJDFOIGJDFOIGJFDOIGDOIGJOI")
})

app.get("/new", (req, res) => {
    res.sendFile("./dashboard/frontend/new.html", {root: "./"})
})

app.get('/api/all', (req, res) => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("homerouter");
        dbo.collection("applications").find({}).toArray(function(err, result) {
            if (err) throw err;
            res.json(result);
            db.close();
        });
    });
})

app.post('/api/new', upload.single('icon'), (req, res) => {
    const name = req.body.name;
    const shortName = req.body.short;
    const isImage = req.file ? true : false;
    const port = req.body.port;
    const requiresAuthentication = req.body.ra !== undefined && req.body.ra == "on" ? true : false;
    const image = req.file.originalname;
    const customURL = req.body.customurl;

    const newApp = {name: name, image: image, shortName: shortName, isImage: isImage, port: port, requiresAuthentication: requiresAuthentication, customURL: customURL == "" ? "" : customURL};
    var file = __dirname + '/frontend/assets/apps/' + req.file.originalname;

    fs.renameSync(req.file.path, file);

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

app.post("/api/users/register", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const group = 0; // 0 = user; 1 = admin;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        const token = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(password, saltRounds);

        const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (${username})`});
        
        

        QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {

            dbo.collection("users").insertOne({username: username, password: hash, token: token, tfa: secret.base32, loggedIn: false, qr: image_data, group: group}, function(err, result) {
                if (err) throw err;

                res.json({status: "complete"});

                db.close();
            });
        })

    });    
})

app.get('/api/users/all', (req, res) => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("homerouter");

        dbo.collection("users").find({}, { projection: { _id: 0, username: 1, loggedIn: 1, qr: 1, lastLogin: 1 } }).toArray((err, result) => {
            if (err) throw err;

            res.send(result)
            db.close();
        });
    });
})

app.get("/*", (req, res) => {
    res.sendFile("./dashboard/frontend/index.html", {root: "./"})
})

console.log("Trying to publish to :" + _CONF.ports.dashboard)


try {
app.listen(_CONF.ports.dashboard, (err) =>{ 
    if(err) throw err;
    console.log('Dashboard Server Started')
})
} catch(err) {
    console.log(err)
}