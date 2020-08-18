const {url} = require('./helpers/mongo') ;
const { MongoClient } = require('mongodb');
// const url = "mongodb://127.0.0.1:27017/";
const _CONF = require('./config');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require("fs");

function start() {
    if(process.env.NODE_ENV == "test") {
        console.log("JUST RETURNING")
        const dash = require('./dashboard/dashboard');
        console.log("DASH")
        console.log(dash)
        return dash;
    }

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        dbo.collection("users").findOne({}, (err, result) => {
            if (err) throw err;
            
            if(result == null) {
                if(process.env.ADMINEMAIL == undefined || process.env.SGKEY == undefined) {
                    console.log(process.env.ADMINEMAIL)
                    console.log(process.env.SGKEY)
                    return;
                }
                // const _AUTH = require('./auth/auth');
                const dash = require('./dashboard/dashboard');
                // _AUTH.registerUser(process.env.USERNAME, process.env.PASSWORD, process.env.EMAIL, 10, resMimic);
                // const express = require('express');
                // const app = express();
                // app.use('/assets', express.static("./dashboard/frontend/assets"));
                
                // // Use req.query to read values!!
                // app.use(bodyParser.json());
                // app.use(bodyParser.urlencoded({ extended: true }));
                // app.get('/', (req, res) => {
                //     res.sendFile(__dirname + '/installation/index.html')
                // });
                
                // app.listen(_CONF.ports.proxy, () => console.log("Installation Server Started"))
            } else {
                const dash = require('./dashboard/dashboard');
            
                
            }
            db.close();
        });
    });
}

console.log(process.env.NODE_ENV)

if(process.env.NODE_ENV != "test") start();

module.exports.start = start;