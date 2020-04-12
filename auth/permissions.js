const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
// const url = "mongodb://127.0.0.1:27017/";
const url = _MongoConfig.url;
const _LOGGER = require('../helpers/logging');

class PermissionHandler {

    constructor() {}

    registerRoutes(app) {
        
        app = app;

        app.get("/groups", (req, res) => {
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                if (err) throw err;
                var dbo = db.db("homerouter");
                dbo.collection("groups").find({}).project({"_id": false}).toArray((err, result) => {
                    if(err) throw err;

                    res.json(result);
                });
            });
        })
    }

    confirmAlreadyExists() {
        MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
            if (err) throw err;
            var dbo = db.db("homerouter");
            dbo.collection("groups").find({}).toArray((err, result) => {
                if(err) throw err;
                if(result.length == 0) {
                    _LOGGER.warn("Creating first group...", "Permissions")
                    const adminGroup = {
                        "name": "Super Users",
                        "level": 10,
                        "modifiable": false,
                        "requireMFA": true,
                        "urlRestrictions": {
                            "base": null,
                            "any": true
                        },
                        "pages": {
                            "apps": {
                                "view": true,
                                "modify": true,
                                "add": true
                            },
                            "users": {
                                "view": true,
                                "modify": true,
                                "add": true
                            },
                            "groups": {
                                "view": true,
                                "modify": true,
                                "add": true
                            },
                            "sites": {
                                "view": true,
                                "modify": true,
                                "add": true
                            },
                            "audits": {
                                "view": true
                            },
                            "stats": {
                                "view": true
                            }
                        }
                    }

                    dbo.collection("groups").insertOne(adminGroup, (err, result) => {
                        if(err) throw err;

                        _LOGGER.log("Created 'Super Users' Group", "Permissions")
                    })
                } else {
                    _LOGGER.log(`Found ${result.length} group(s)`, "Permissions")
                }
            })
        });
    }

    findPerm(find, obj) {
        find = find.split(".");
        if(find.length == 1) {
            return obj[find]
        } else {
            let n = find.shift();
            return this.findPerm(find.join("."), obj[n])
        }
    }

    hasPermission(username, permission) {
        const _this = this;
        return new Promise(resolve => {
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                if (err) throw err;
                var dbo = db.db("homerouter");
                dbo.collection("users").find({username: username}).toArray((err, userInfo) => {
                    if(err) throw err;

                    dbo.collection("groups").findOne({name: userInfo[0].isInGroup}, (err, groupInfo) => {
                        if(err) throw err;

                        resolve(_this.findPerm(permission, groupInfo))
                    })
                })
            });
        })
    }
}

module.exports = PermissionHandler;