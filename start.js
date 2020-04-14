const _MongoConfig = require('./helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;
const _CONF = require('./config');
var bodyParser = require('body-parser')
var multer  = require('multer');
var fs = require("fs");

MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    var dbo = db.db("homerouter");
    dbo.collection("users").findOne({force: true}, (err, result) => {
        if (err) throw err;
        
        if(result == null) {
            const express = require('express');
            const app = express();

            app.use('/assets', express.static("./dashboard/frontend/assets"));
            
            // Use req.query to read values!!
            app.use(bodyParser.json());
            app.use(bodyParser.urlencoded({ extended: true }));

            app.get('/', (req, res) => {
                res.sendFile(__dirname + '/installation/index.html')
            });
            
            app.listen(_CONF.ports.proxy, () => console.log("Installation Server Started"))
        } else {
            const dash = require('./dashboard/dashboard');
        }

        db.close();
    });
});