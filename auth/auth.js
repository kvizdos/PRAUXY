// Install body-parser and Express
const express = require('express')
const app = express()

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;

const request = require('request');

const bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')

const bcrypt = require('bcrypt');
const saltRounds = 10;

const speakeasy = require('speakeasy');
const QRCode = require("qrcode");
let tempToken;

let tokenCache = [];
const _CONF = require('../config');

const _REDIS = new (require('../helpers/redis'))();
const _AUTH = new (require('./confirmAuth'))(_REDIS);

const _LOGGER = require('../helpers/logging');

// Use req.query to read values!!
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())

app.use('/assets', express.static("./auth/frontend/static"));

app.get("/", (req, res) => {

    _AUTH.authenticate(req.cookies.kvToken).then(authed => {
        if(authed) {
            res.redirect(_CONF.createURL())
        } else {
            res.sendFile("./auth/frontend/index.html", {root: "./"})
        }
    })
})

app.get("/verify/*", (req, res) => {
    let redirectTo = "/" + req.url.split("/").splice(3).join("/");

    // const verified = tokenCache.filter(c => c == req.cookies.kvToken).length > 0;

    // if(verified) {
    //     res.redirect(redirectTo);
    // } else {
    //     res.redirect(_CONF.createURL("auth"));
    // }

    authenticate(req.cookies.kvToken).then(authed => {
        if(authed) {
            res.redirect(redirectTo);
        } else {
            res.redirect(_CONF.createURL("auth"));
        }
    })

    // res.json({redirectTo: redirectTo});
})

app.get("/login", (req, res) => {res.json({success: true})})

app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        dbo.collection("users").findOne({username: username}, function(err, result) {
            if (err) throw err;

            if(result != null) {


                bcrypt.compare(password, result['password'], (err, verify) => {

                    if(verify) {

                        const newToken = bcrypt.genSaltSync(saltRounds);
                        _REDIS.set(`AUTHTOKEN:${username}`, newToken, 60);
                        
                        if(result.loggedIn) {
                            res.json({authenticated: true, showMFA: false});
                        } else {
                            res.json({authenticated: true, showMFA: true, qr: result.qr})
                        }
                        dbo.collection("users").updateOne({username: username}, {$set: {token: newToken}}, (err, res) => {
                            if(err) if(err) _LOGGER.warn(err, "Authorization");

                            db.close();

                        });


                    } else {
                        res.json({authenticated: false});
                    }
                })
            } else {
                res.json({authenticated: false});
            }

        });
    });
});

app.post("/login/mfa", (req, res) => {
    const username = req.body.username;
    const mfa = req.body.mfa;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        dbo.collection("users").findOne({username: username}, (err, result) => {

            const secret = result['tfa'];
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: mfa
            })

            _REDIS.get(`AUTHTOKEN:${username}`).then(token => {
                if(token == null) {
                    _LOGGER.error(`Someone attempted to login directly through TFA (${req.headers['x-forwarded-for'] || req.connection.remoteAddress})`, "Authorization")
                    res.json({authenticated: false})
                    return;
                }

                if(verified) {
                    _REDIS.set(`AUTHTOKEN:${username}`, "", 1);
                    tokenCache.push(token);

                    res.json({authenticated: true, token: token});

                    dbo.collection("users").updateOne({username: username}, {$set: {loggedIn: true, lastLogin: + (new Date)}}, (err, res) => {
                        if(err) _LOGGER.warn(err, "Authorization");
                        db.close();
                    });

                } else {
                    _LOGGER.warn(`Incorrect TFA code used for ${username} (${mfa})`)
                    res.json({authenticated: false});
                }
            })

            db.close();
        });

    });

})

MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db("homerouter");

    dbo.collection("users").find({}).toArray((err, result) => {
        if(err) throw err;

        if(result.length == 0) {
            const token = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync("admin", saltRounds);

            const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (admin)`});

            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {
                dbo.collection("users").insertOne({username: "admin", password: hash, token: token, tfa: secret.base32, loggedIn: false, qr: image_data}, function(err, result) {
                    if (err) throw err;

                    _LOGGER.log("Admin registered (admin/admin)", "user");

                    db.close();
                });

            })

        }
    });

});
// app.get('*', (req, res) => res.redirect("/auth"))

app.listen(_CONF.ports.auth, () => _LOGGER.log(`Started on ${_CONF.ports.auth}`, "Authorization"))