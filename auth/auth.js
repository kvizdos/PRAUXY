// Install body-parser and Express
const express = require('express')
const app = express()
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;

const bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')

const bcrypt = require('bcrypt');
const saltRounds = 10;

const speakeasy = require('speakeasy');
const QRCode = require("qrcode");

const _CONF = require('../config');

const _REDIS = new (require('../helpers/redis'))();
const _PERMISSIONS = new (require('./permissions'))();

const _AUTH = new (require('./confirmAuth'))(_REDIS);
const _LOGGER = require('../helpers/logging');

const _EMAIL = new (require("../helpers/email")).email();

const axios = require("axios");

let activeLogins = [];

function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

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
app.use('/assets/forms.css', express.static("./dashboard/frontend/assets/forms.css"));

app.get("/", (req, res) => {

    _AUTH.authenticate(req.cookies.prauxyToken).then(authed => {
        if(authed) {
            res.redirect(_CONF.createURL())
        } else {
            res.sendFile("./auth/frontend/index.html", {root: "./"})
        }
    })
})

app.get("/oauth/github", (req, res) => {
    const reqToken = req.query.code;

    axios({
        method: 'post',
        url: `https://github.com/login/oauth/access_token?client_id=${process.env.GITHUB_ID}&client_secret=${process.env.GITHUB_SECRET}&code=${reqToken}`,
        headers: {
            accept: 'application/json'
        }
    }).then(resp => {
        const accessToken = resp.data.access_token;

        let { prauxyToken } = parseCookies(req);

        prauxyToken = prauxyToken.split(":")[1];

        if(accessToken) {
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                if (err) throw err;
                var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
                dbo.collection("users").updateOne({username: prauxyToken}, {$set: { 'connections.github': { access_token: accessToken } }}, function(err, result) {});
            });
        }

        res.redirect(_CONF.createURL() + "/me/settings");
    })
})

app.get("/verify/*", (req, res) => {
    let redirectTo = "/" + req.url.split("/").splice(3).join("/");

    // const verified = tokenCache.filter(c => c == req.cookies.prauxyToken).length > 0;

    // if(verified) {
    //     res.redirect(redirectTo);
    // } else {
    //     res.redirect(_CONF.createURL("auth"));
    // }

    authenticate(req.cookies.prauxyToken).then(authed => {
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
    const socketid = req.body.socketid;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        dbo.collection("users").findOne({username: username}, function(err, result) {
            if (err) throw err;

            if(result != null) {


                bcrypt.compare(password, result['password'], (err, verify) => {

                    if(verify) {

                        const newToken = bcrypt.genSaltSync(saltRounds);
                        const tfaNum = Math.floor(Math.random() * 100) + 1;

                        _REDIS.set(`AUTHTOKEN:${username}`, newToken, 60);
                        _REDIS.set(`AUTHTFA:${username}`, `${socketid}:${tfaNum}`, 180);

                        const tfa1 = Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
                        const tfa2 = tfa1 != tfaNum && Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
                        const tfa3 = tfa1 != tfaNum && tfa2 != tfaNum ? tfaNum : Math.floor(Math.random() * 100) + 1;

                        activeLogins.push({socket: socketid, username: username});

                        if(process.env.NODE_ENV != 'test') module.exports.dashboardSocket.to(username).emit('confirmTfaNum', tfa1, tfa2, tfa3);
                        
                        if(result.loggedIn) {
                            res.json({authenticated: true, showMFA: false, tfaNum: tfaNum});
                        } else {
                            res.json({authenticated: true, showMFA: true, qr: result.qr, tfaNum: tfaNum})
                        }
                        dbo.collection("users").updateOne({username: username}, {$set: {token: newToken}}, (err, res) => {
                            if(err) if(err) _LOGGER.warn(err, "Authorization");

                            db.close();

                        });


                    } else {
                        res.status(401).json({authenticated: false});
                    }
                })
            } else {
                res.status(401).json({authenticated: false});
            }

        });
    });
});

app.post("/login/mfa", (req, res) => {
    const username = req.body.username;
    const mfa = req.body.mfa;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
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
                    res.status(401).json({authenticated: false, reason: "direct tfa"})
                    return;
                }

                if(verified) {
                    _LOGGER.warn(`${username} logged in`)
                    _REDIS.remove(`AUTHTOKEN:${username}`);

                    res.json({authenticated: true, token: token, group: result.group, connections: { github: result.connections != undefined && result.connections.github.access_token != undefined }});

                    dbo.collection("users").updateOne({username: username}, {$set: {loggedIn: true, lastLogin: + (new Date)}}, (err, result) => {                        
                        if(err) _LOGGER.warn(err, "Authorization");
                        db.close();

                    });

                } else {
                    _LOGGER.warn(`Incorrect TFA code used for ${username} (${mfa})`)
                    res.status(401).json({authenticated: false, reason: "incorrect tfa"});
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

    registerUser(username, password, email, group, res);
})

const registerUser = (username, password, email, group, res) => {
    if(username == undefined || password == undefined || email == undefined || group == undefined) {
        res.status(400).json({status: "fail", reason: "invalid params"})
        return;
    }

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        const token = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(password, saltRounds);

        dbo.collection("users").find({username: username}, { projection: { _id: 0, username: 1 } }).toArray((err, result) => {
            if(result.length > 0) {
                res.status(409).json({status: "fail", reason: "username exists"})
                return;
            }

            const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (${username})`});

            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {
                if(process.env.NODE_ENV == "test") global.__PRAUXY_TEST_TFA_OTHERS__[username] = secret.base32;

                dbo.collection("users").insertOne({username: username, password: hash, email: email, token: token, tfa: secret.base32, loggedIn: false, qr: image_data, group: group}, function(err, result) {
                    if (err) throw err;

                    _LOGGER.log(`User ${username} created (${group})`)
                    if(process.env.NODE_ENV != "test") _EMAIL.sendEmail(email, "Prauxy Login Information", _EMAIL.newUserTemplate({username: username, password: password}));
                    _LOGGER.log(`User registered (${username})`, "user");

                    res.json({status: "complete"});

                    db.close();
                });
            })
        });
    });
}

app.post("/users/update", (req, res) => {
    const type = req.body.type;

    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        
        switch(type) {
            case "changeemail":
                var username = req.body.username;
                var email = req.body.email;

                if(username == undefined || email == undefined) {
                    res.status(400).json({status: "fail", reason: "invalid params"})
                    return;
                }

                dbo.collection("users").updateOne({username: username}, {$set: { email: email }}, (err, result) => {
                    if(result.matchedCount == 0) {
                        res.status(400).json({status: "fail", reason: "user does not exist"})
                        return;
                    } 
                    res.json({status: "complete"});

                });
                break;
            case "resetpw":
                var username = req.body.username;
                var old = req.body.old;
                var newp = req.body.newp;

                if(username == undefined || old == undefined || newp == undefined) {
                    res.status(400).json({status: "fail", reason: "invalid params"})
                    return;
                }

                const hashedNew = bcrypt.hashSync(newp, saltRounds);

                dbo.collection("users").findOne({username: username}, function(err, result) {
                    if (err) throw err;

                    if(result != null) {
                        bcrypt.compare(old, result['password'], (err, verify) => {

                            if(verify) {
                                dbo.collection("users").updateOne({username: username}, {$set: { password: hashedNew }}, (err, result) => {                                    
                                    res.json({status: "complete"});
                                    return;
                                });

                            } else {
                                res.status(400).json({status: "fail", reason: "old pass not right"});
                            }
                        })
                    } else {
                        res.status(400).json({status: "fail", reason: "user does not exist"});
                    }
                });
                break;
            case "delete":
                if(!_AUTH.isAdmin(req, res)) { return; }
                dbo.collection("users").deleteOne({username: req.body.username}, (err, result) => {
                    if(result.result.n == 0 || result.result.n == undefined) {
                        res.status(400).json({status: "fail", reason: "invalid user"})
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
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

        dbo.collection("users").find({}, { projection: { _id: 0, username: 1, loggedIn: 1, lastLogin: 1, email: 1, connections: 1 } }).toArray((err, result) => {
            if (err) throw err;

            for(let i = 0; i < result.length; i++) {
                if(result[i].connections != undefined) {
                    result[i].connections.github = result[i].connections.github != undefined;
                }
            }

            res.send(result)
            db.close();
        });
    });
})

MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
    if (err) throw err;
    var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

    _PERMISSIONS.registerRoutes(app);
    _PERMISSIONS.confirmAlreadyExists();

    if(process.env.NODE_ENV == "test") return;

    dbo.collection("users").find({username: "admin"}).toArray((err, result) => {
        if(err) throw err;

        if(result.length == 0) {
            if(process.env.ADMINEMAIL == undefined || process.env.ADMINEMAIL == "") {
                _LOGGER.error("First launch; you must specify an admin email w/ the environment variable, 'ADMINEMAIL'", "Critical")
                process.exit(22);
            }
            const token = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync("admin", saltRounds);

            const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (admin)`});

            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {
                dbo.collection("users").insertOne({email: process.env.ADMINEMAIL, username: "admin", password: hash, token: token, tfa: secret.base32, loggedIn: process.env.NODE_ENV == "test", qr: image_data, group: 10, isInGroup: "Super Users"}, function(err, result) {
                    if (err) throw err;

                    _LOGGER.log("Admin registered (admin/admin)", "user");

                    db.close();
                });

            })

        } else if(result[0].email == "" || result[0].email == undefined) {
            _LOGGER.error("First launch; you must specify an admin email w/ the environment variable, 'ADMINEMAIL'", "Critical")
            process.exit(22);
        }
    });

    

});

io.on('connection', (socket) => {
    socket.on('disconnect', () => {
        let activeSocket = activeLogins.filter(s => {
            return s.socket == socket.id
        })[0];


        if(activeSocket) {
            _REDIS.get(`AUTHTFA:${activeSocket.username}`).then(r => {
                if(r) {
                    _REDIS.remove(`AUTHTFA:${activeSocket.username}`);
                }
            });
        }
    })
})

const resetTFA = (username, socket) => {
    if(io.sockets.sockets[socket]) {
        const tfaNum = Math.floor(Math.random() * 100) + 1;

        _REDIS.set(`AUTHTFA:${username}`, `${socket}:${tfaNum}`, 180);

        const tfa1 = Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
        const tfa2 = tfa1 != tfaNum && Math.floor(Math.random() * 3) + 1 == 1 ? tfaNum : Math.floor(Math.random() * 100) + 1;
        const tfa3 = tfa1 != tfaNum && tfa2 != tfaNum ? tfaNum : Math.floor(Math.random() * 100) + 1;

        io.to(socket).emit('resetTFA', tfaNum);

        module.exports.dashboardSocket.to(username).emit('confirmTfaNum', tfa1, tfa2, tfa3);
    } 
}

module.exports.dashboardSocket = undefined;
module.exports.authSocket = io;
module.exports.resetTFA = resetTFA;
module.exports.registerUser = registerUser;
module.exports.http = http;

// if(process.env.NODE_ENV != 'test') {
    http.listen(_CONF.ports.auth, () => _LOGGER.log(`Started on ${_CONF.ports.auth}`, "Authorization"))
// } else {
    // module.exports.app = app;
// }