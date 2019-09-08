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

app.get('/api/users/all', (req, res) => {
    
})

app.post('/api/new', upload.single('icon'), (req, res) => {
    const name = req.body.name;
    const shortName = req.body.short;
    const isImage = req.file ? true : false;
    const port = req.body.port;
    const requiresAuthentication = req.body.ra !== undefined && req.body.ra == "on" ? true : false;
    const image = req.file.originalname;
    const customURL = req.body.customurl;

    const newApp = {name: name, image: image, shortName: shortName, isImage: isImage, port: port, requiresAuthentication: requiresAuthentication, customURL: customURL == "" ? "BASE" : customURL};
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