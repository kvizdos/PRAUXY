const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;
const _LOGGER = require('../helpers/logging');
const _CONF = require('../config');
const _PM = require('../proxy/proxy');

const _HOST = require('./host')

/*
const cors = require('cors')
const corsOptions = {
    origin: _CONF.createURL('')
}
console.log(corsOptions)
*/
const bcrypt = require('bcrypt');

const fs = require('fs');

const {exec} = require("child_process")
var bodyParser = require('body-parser')

const express = require('express')
const app = express()

const crypto = require('crypto')

class SiteLauncher {
    constructor() {
        const _this = this;
        MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
            var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
            dbo.collection("sites").find({}).toArray((err, results) => {
                for(let result of results) {
                    _this.registerSite(result.shortName, result.customURL || undefined)
                }
            });
        
        });

        app.use(function(req, res, next){
	    //	console.log("allowed from: " + _CONF.createURL());
            res.header('Access-Control-Allow-Origin', 'https://home.kentonvizdos.com');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST');
            res.header('Access-Control-Allow-Credentials', true)
            next();
        })
        
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.post("/api/update", (req, res) => {
            const updating = req.body.repository.name;

            const createComparisonSignature = (body, secret) => {
              const hmac = crypto.createHmac('sha1', secret);
              const self_signature = hmac.update(JSON.stringify(body)).digest('hex');
              return `sha1=${self_signature}`; // shape in GitHub header
            }
            
            const compareSignatures = (signature, comparison_signature) => {
              const source = Buffer.from(signature);
              const comparison = Buffer.from(comparison_signature);
              return crypto.timingSafeEqual(source, comparison); // constant time comparison
            }


            MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
                var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
                dbo.collection("sites").findOne({name: updating}, (err, result) => {
                    if(err) console.log(err)
    
                    if(result != null) {
                        const { headers, body } = req;

                        const signature = headers['x-hub-signature'];
                        const comparison_signature = createComparisonSignature(body, result.pushSecret);
                        if (!compareSignatures(signature, comparison_signature)) {
                            return res.status(401).json({status: "invalid verification"})
                        } else {
                            exec(`echo $pwd && cd ./sites/data/${updating} && git pull`, (err, stdout, stderr) => {
                                if(err) {
                                    res.json({done: false})
                                }

                                res.json({done: true});

                            })
                        }
                    } else {
                        res.status(400).json({status: "failed", reason: "name does not exist"})
                    }
                });
            });
        })

        app.post("/api/create", (req, res) => {
            this.addSite(req, res, req.body.name, req.body.shortName, req.body.repo, req.body.customurl || undefined, req.body.root);
        })

        app.get("/api/all", (req, res) => {
            MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
                var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
                dbo.collection("sites").find({}).project({_id: 0}).toArray((err, results) => {
                    res.json(results)
                });
            
            });
        })

        app.get("/404", (req, res) => {
            res.send("That file does not seem to exist.")
        })

        app.get("/", (req, res) => {
            res.redirect(_CONF.createURL())
        })
        app.listen(_CONF.ports.siteLauncher, () => _LOGGER.log("Started", "Site Launcher"))
    }

    addSite(req, res, name, short, repo, customURL = undefined, rootDir = "/") {
        const postSecret = bcrypt.genSaltSync(10);
        const _this = this;

        const newSite = {
            name: name,
            shortName: short,
            repo: repo,
            root: repo.split("/")[repo.split("/").length - 1] + "/" + rootDir,
            pushSecret: postSecret,
            customURL: customURL
        }

        MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
            var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
            dbo.collection("sites").findOne({name: name, shortName: short}, (err, result) => {
                if(err) console.log(err)

                const create = () => {
                    dbo.collection("sites").insertOne(newSite, (err, resu) => {
                        if(fs.existsSync(`./sites/data/${repo.split("/")[repo.split("/").length - 1]}`)) {
                            _LOGGER.log(`New Static Site: ${name}`, "Site Launcher")
                            _this.registerSite(short, customURL);
            
                            res.json({status: "complete", secret: postSecret})
                        } else {
                            exec(`cd ./sites/data/ && git clone ${repo}`, (err, stdout, stderr) => {
                                if(err) {
                                    console.log(err)
                                    return res.json({status: "failed"})
                                }

                                _LOGGER.log(`New Static Site: ${name}`, "Site Launcher")

                                _this.registerSite(short, customURL);
            
                                res.json({status: "complete", secret: postSecret})

                            })
                        }
                    });
                }

                if(result == null) {
                    if(customURL != undefined) {
                        dbo.collection("applications").findOne({customURL: customURL}, (err, result) => {
                            if(result != null) {
                                return res.json({status: "failed", reason: "custom url taken"})
                            } else {
                                create();
                            }
                        });
                    } else {
                        create();
                    }
                } else {
                    res.status(400).json({status: "failed", reason: "name taken"})
                }
            });
        });
    }

    registerSite(shortName, customURL = undefined) {
        if(customURL != undefined) {
            _PM.add("site-" + shortName, _CONF.ports.siteLauncherHost, false, customURL);
        } else {
            _PM.add("site-" + shortName, _CONF.ports.siteLauncherHost, false);
        }

        _LOGGER.log(`Started site ${shortName}${customURL != undefined ? ` (${customURL})` : ""}`, "Site Launcher Host")
    }
}

module.exports = SiteLauncher;
