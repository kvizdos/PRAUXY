// authorization.test.js

const supertest = require('supertest');
const { MongoClient } = require('mongodb');
const { url } = require('../helpers/mongo');
const { authenticator } = require('otplib');
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const QRCode = require("qrcode");

let otpKey = "";

beforeAll(async done => {
    process.env.NODE_ENV = "test";
    process.env.ADMINEMAIL = "test@prauxy.app"
    
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
                    done();

                    return true;
                });
            });
        });
    });
})

const auth = require('../auth/auth').http;

afterEach(() => auth.close())

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

describe("Authorization API", () => {
    it("Server starts", async done => {
        const response = await supertest(auth).get("/");
        expect(response.statusCode).toBe(200)
        done();
    })

    it("User fails to login with incorrect info", async done => {
        const response = await supertest(auth).post("/login").send({
            username: "admin",
            password: "passwords",
            socketid: "test-socket-id"
        });

        expect(response.statusCode).toBe(401);
        expect(response.body.authenticated).toBe(false);
        done();
    })

    it("User successfully logs in", async done => {
        const response = await supertest(auth).post("/login").send({
            username: "admin",
            password: "admin",
            socketid: "test-socket-id"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.authenticated).toBe(true);
        done();
    })

    it("Incorrect MFA token fails", async done => {
        const response = await supertest(auth).post("/login/mfa").send({
            username: "admin",
            mfa: "123456"
        });

        expect(response.body.authenticated).toBe(false);
        expect(response.statusCode).toBe(401);
        done();
    })

    it("Correct MFA token succeeds", async done => {
        const response = await supertest(auth).post("/login/mfa").send({
            username: "admin",
            mfa: authenticator.generate(global.__PRAUXY_TEST_TFA__)
        });

        console.log("MFMFAMFMAMFAMFAMA TOKEN: " + response.body.token)

        global.__PRAUXY__ = {
            token: response.body.token,
            group: response.body.group,
            level: 10
        }

        expect(response.statusCode).toBe(200);
        expect(response.body.authenticated).toBe(true);
        done();
    })

    it("isAdmin() confirms a users group level", async done => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=asdf:blah:0`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(401);
        expect(response.body.error).toBe("You do not have a high enough group to do this.")
        done();
    })

    it("Rejects malformed registration request", async done => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]);

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
        done();
    })

    it("User registration works", async done => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
        done();
    })

    it("Registration fails if username is taken", async done => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(409);
        expect(response.body.reason).toBe("username exists");
        done();
    })
})

describe("Profile Updates API", () => {
    it("Update email fails due to invalid params", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
        done();
    })
    
    it("Update email fails because user does not exist", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
            username: "fake user",
            email: "test-new@prauxy.app"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("user does not exist");
        done();
    })
    
    it("Update email succeeds", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
            username: "newUser",
            email: "test-new@prauxy.app"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
        done();
    })

    it("Reset password fails due to invalid params", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
        done();
    })

    it("Reset password fails because user does not exist", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "fake user",
            old: "password123",
            newp: "password321"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("user does not exist");
        done();
    })

    it("Reset password fails because verification of password does not match", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "newUser",
            old: "bad password",
            newp: "password321"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("old pass not right");
        done();
    })

    it("Reset password succeeds", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "newUser",
            old: "password123",
            newp: "password321"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
        done();
    })

    it("Deleting a user fails because of an invalid username", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "delete",
            username: "newUsers"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid user");
        done();
    })

    it("Deleting a user succeeds", async done => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "delete",
            username: "newUser"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
        done();
    })
})