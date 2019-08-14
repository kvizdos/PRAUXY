const redis = require('redis')

class RedisManager {
    constructor() {
        try {
            // this.client = new redis({host:})
        this.client = redis.createClient({host: 'redis'});
        } catch(err) {
            console.log(err);
        }
        this.client.on("error", function (err) {
            console.log("Error " + err);
        });

        this.client.on("connect", () => {
            console.log("Connected to Redis")
        })


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