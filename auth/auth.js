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

const _CONF = require('../config');

const _REDIS = new (require('../helpers/redis'))();
const _AUTH = new (require('./confirmAuth'))(_REDIS);

const _LOGGER = require('../helpers/logging');

const _EMAIL = new (require("../helpers/email")).email();

// Use req.query to read values!!
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())

app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', _CONF.createURL());
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Credentials', true)
    next();
  })

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

                    res.json({authenticated: true, token: token, group: result.group});

                    dbo.collection("users").updateOne({username: username}, {$set: {loggedIn: true, lastLogin: + (new Date)}}, (err, result) => {                        
                        if(err) _LOGGER.warn(err, "Authorization");
                        db.close();

                    });

                } else {
                    _LOGGER.warn(`Incorrect TFA code used for ${username} (${mfa})`)
                    res.json({authenticated: false});
                    db.close();
                }
            })

        });

    });

})

// Handle general User stuff
app.post("/users/register", _AUTH.isAdmin, (req, res) => {
    const username = req.body.username;
    const password = req.body.password || bcrypt.genSaltSync(2).substr(8);
    const email    = req.body.email;
    const group    = req.body.group || 0;

    if(username == undefined || email == undefined || group == undefined) {
        res.json({status: "fail", reason: "invalid params"})
        return;
    }

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        const token = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(password, saltRounds);

        dbo.collection("users").find({username: username}, { projection: { _id: 0, username: 1 } }).toArray((err, result) => {
            if(result.length > 0) {
                res.json({status: "fail", reason: "username exists"})
                return;
            }

            const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (${username})`});

            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {

                dbo.collection("users").insertOne({username: username, password: hash, email: email, token: token, tfa: secret.base32, loggedIn: false, qr: image_data, group: group}, function(err, result) {
                    if (err) throw err;

                    _LOGGER.log(`User ${username} created (${group})`)
                    const resp = _EMAIL.sendEmail(email, "Auxy Login Information", _EMAIL.newUserTemplate({username: username, password: password}));
                    _LOGGER.log(`User registered (${username})`, "user");

                    res.json({status: "complete"});

                    db.close();
                });
            })
        });
    });    
})

app.post("/users/update", (req, res) => {
    const type = req.body.type;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("homerouter");
        
        switch(type) {
            case "resetpw":
                const username = req.body.username;
                const old = req.body.old;
                const newp = req.body.newp;

                if(username == undefined || old == undefined || newp == undefined) {
                    res.json({status: "fail", reason: "invalid params"})
                    return;
                }

                const hashedNew = bcrypt.hashSync(newp, saltRounds);

                dbo.collection("users").findOne({username: username}, function(err, result) {
                    if (err) throw err;

                    if(result != null) {
                        bcrypt.compare(old, result['password'], (err, verify) => {

                            if(verify) {
                                dbo.collection("users").updateOne({username: username}, {$set: { password: hashedNew }}, (err, result) => {
                                    console.log(result.result);
                                    
                                    if(result.result.nModified == 0) {
                                        res.json({status: "fail", reason: "user does not exist"})
                                        return;
                                    } 
                                    res.json({status: "complete"});
                                    return;
                                });

                            } else {
                                res.json({status: "fail", reason: "old pass not right"});
                            }
                        })
                    } else {
                        res.json({authenticated: false});
                    }
                });
                break;
            case "delete":
                if(!_AUTH.isAdmin(req, res)) { return; }
                dbo.collection("users").deleteOne({username: req.body.username}, (err, result) => {
                    if(result.n == 0) {
                        res.json({status: "fail", reason: "invalid user"})
                        return;
                    }

                    res.json({status: 'complete'})
                    db.close();
                })
                break;
        }
    });

})

app.get('/users/all', (req, res) => {
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        var dbo = db.db("homerouter");

        dbo.collection("users").find({}, { projection: { _id: 0, username: 1, loggedIn: 1, qr: 1, lastLogin: 1 } }).toArray((err, result) => {
            if (err) throw err;

            res.send(result)
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
                dbo.collection("users").insertOne({username: "admin", password: hash, token: token, tfa: secret.base32, loggedIn: false, qr: image_data, group: 10}, function(err, result) {
                    if (err) throw err;

                    _LOGGER.log("Admin registered (admin/admin)", "user");

                    db.close();
                });

            })

        }
    });

});

app.listen(_CONF.ports.auth, () => _LOGGER.log(`Started on ${_CONF.ports.auth}`, "Authorization"))