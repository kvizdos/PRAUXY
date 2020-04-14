const redis = require('redis')
const _LOGGER = require('./logging')

class RedisManager {
    constructor() {
        try {
            // this.client = new redis({host:})
        this.client = redis.createClient();
        } catch(err) {
            _LOGGER.error(err, "Redis");
        }
        this.client.on("error", function (err) {
            _LOGGER.error(err, "Redis");
        });

        this.client.on("connect", () => {
            _LOGGER.log("Connection Created", "Redis")
        })


    }

    set(key, val, expireTime = -1) {
        if(expireTime == -1) {
            this.client.set(key, val);
        } else {
            this.client.set(key, val, 'EX', expireTime)
        }
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