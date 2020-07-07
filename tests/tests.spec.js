process.env.NODE_ENV = "test";
process.env.ADMINEMAIL = "test@prauxy.app"

const supertest = require('supertest');

const { MongoClient } = require('mongodb');
const { url } = require('../helpers/mongo');
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const QRCode = require("qrcode");
const _REDIS = new (require('../helpers/redis'))();

let app = require('../start').start()
let request = supertest(app.proxy.proxy.server);

const auth = require("./authorization");
const proxy = require("./proxy");
const dash = require("./dashboard");

beforeAll(async (done) => {
    process.env.NODE_ENV = "test";
    global.__PRAUXY_TEST_TFA_OTHERS__ = {};

    // Reset Database
    MongoClient.connect(url, { useNewUrlParser: true }, async (err, db) => {
        if (err) throw err;
        var dbo = db.db("prauxy-test");
        dbo.dropDatabase(async (err, dropResult) => {
            const saltRounds = 10;
            const token = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync("admin", saltRounds);
            const secret = speakeasy.generateSecret({ length: 20, name: `HOME Router (admin)` });
            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {
                if (process.env.NODE_ENV == "test")
                    global.__PRAUXY_TEST_TFA__ = secret.base32;
                dbo.collection("users").insertOne({ email: process.env.ADMINEMAIL, username: "admin", password: hash, token: token, tfa: secret.base32, loggedIn: process.env.NODE_ENV == "test", qr: image_data, group: 10, isInGroup: "Super Users" }, async (err, result) => {
                    if (err) return false;
                    db.close();

                    await _REDIS.flushdb();
                    done();

                    return true;
                });
            });
        });
    });
})


test('Database is seeded', async done => {
    MongoClient.connect(url, { useNewUrlParser: true }, async (err, db) => {
        if (err) throw err;
        var dbo = db.db("prauxy-test");

        dbo.collection("users").find({}).toArray((err, res) => {
            if(err) throw err;

            console.log(res)

            expect(res.length).toBe(1);
            done();
        })
    });
})

describe("Authorization Tests", () => {
    return auth.tests(request);
});

describe("Dashboard Tests", () => {
    return dash.tests(request);
});

describe("Proxy Tests", () => {
    return proxy.tests(request);
});