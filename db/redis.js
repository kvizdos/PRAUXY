const redis = require('redis')

class RedisManager {
    constructor() {
        this.client = redis.createClient();
    }

    set(key, val) {
        this.client.set(key, val);
    }

    get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, reply) => {
                if(err) throw err;

                resolve(reply);
            })
        })
    }
}

module.exports = RedisManager;