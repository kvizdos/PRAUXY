let cachedTokens = [];

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

class Authenticator {
    constructor(redis) {
        this.id = Math.floor(Math.random() * 1000)
        this._REDIS = redis;
    }

    authenticate(tempToken, confirmRequiresAuth = false) {

        if(tempToken == undefined) tempToken = "x.x"
    
        let token = tempToken.split(":")[0];
        let user = tempToken.split(":")[1];

        const _this = this;
    
        return new Promise((resolve, reject) => {
            _this._REDIS.get(`APP:${confirmRequiresAuth}`).then(requiresAuth => {
                requiresAuth = JSON.parse(requiresAuth) != null ? JSON.parse(requiresAuth).requiresAuth : true;
                if(requiresAuth == false) {
                    return resolve(true);
                }
                _this._REDIS.get(`${user}:${token}`).then(hasCache => {
                    if(token !== undefined) {
                        if(hasCache) {
                            resolve(true);
                        } else {
                            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                                if (err) throw err;
                                var dbo = db.db("homerouter");
            
                                dbo.collection("users").findOne({username: user, token: token}, (err, u) => {
                                    if(err) throw err;
                                    if(u != null) {
                                        _this._REDIS.set(`${user}:${token}`, true);

                                        resolve(true)
                                    }
            
                                    resolve(false);
                                })
                            });
                        }
                    }
                })
            })
        })
    }
}

module.exports = Authenticator;