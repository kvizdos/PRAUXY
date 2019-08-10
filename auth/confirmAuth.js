let cachedTokens = [];

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

const authenticate = (tempToken) => {

    if(tempToken == undefined) {
        return new Promise((resolve, reject) => resolve(false));
    }

    let token = tempToken.split(":")[0];
    let user = tempToken.split(":")[1];

    return new Promise((resolve, reject) => {
        if(token !== undefined) {
            const hasCache = cachedTokens.filter(t => {
                return t.token == token && t.user == user
            }).length > 0;
            if(hasCache) {
                resolve(true);
            } else {
                MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                    if (err) throw err;
                    var dbo = db.db("homerouter");

                    dbo.collection("users").findOne({username: user, token: token}, (err, u) => {
                        if(err) throw err;
                        if(u != null) {
                            const newCache = {
                                user: user,
                                token: token
                            }

                            cachedTokens.push(newCache)
                            resolve(true)
                        }

                        resolve(false);
                    })
                });
            }
        }
    })
}

module.exports = authenticate;