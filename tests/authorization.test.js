// authorization.test.js

const supertest = require('supertest');
const { MongoClient } = require('mongodb');
const { url } = require('../helpers/mongo');
const { authenticator } = require('otplib');
const speakeasy = require('speakeasy');
const bcrypt = require('bcrypt');
const QRCode = require("qrcode");

let otpKey = "";

beforeAll(() => {
    process.env.NODE_ENV = "test";

    global.console = {
        log: jest.fn()
    }

    console.log("Seeding database...")
    // Seed Database
    MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
        if (err) throw err;
        var dbo = db.db("prauxy-test");

        dbo.dropDatabase((err, dropResult) => {
            if(err) throw err;

            var dbo = db.db("prauxy-test");

            const saltRounds = 10;
    
            const token = bcrypt.genSaltSync(saltRounds);
            const hash = bcrypt.hashSync("password", saltRounds);
    
            const secret = speakeasy.generateSecret({length: 20, name: `HOME Router (admin)`});
    
            QRCode.toDataURL(secret.otpauth_url, (err, image_data) => {
                otpKey = secret.base32;
                dbo.collection("users").insertOne({username: "admin", password: hash, email: "testing@prauxy.app", token: token, tfa: secret.base32, loggedIn: true, qr: image_data, group: "Super Users"}, function(err, result) {
                    if (err) throw err;                    
                    
                    console.log("Database seeded.")
                    db.close();
                });
            })
        })
    });
})

const auth = require('../auth/auth').http;

afterEach(() => auth.close())


describe("Authorization API", () => {
    it("Server starts", async () => {
        const response = await supertest(auth).get("/");
        expect(response.statusCode).toBe(200)
    })

    it("User fails to login with incorrect info", async () => {
        const response = await supertest(auth).post("/login").send({
            username: "admin",
            password: "passwords",
            socketid: "test-socket-id"
        });

        expect(response.statusCode).toBe(401);
        expect(response.body.authenticated).toBe(false);
    })

    it("User successfully logs in", async () => {
        const response = await supertest(auth).post("/login").send({
            username: "admin",
            password: "password",
            socketid: "test-socket-id"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.authenticated).toBe(true);
    })

    it("Incorrect MFA token fails", async () => {
        const response = await supertest(auth).post("/login/mfa").send({
            username: "admin",
            mfa: "123456"
        });

        expect(response.statusCode).toBe(401);
        expect(response.body.authenticated).toBe(false);
    })

    it("Correct MFA token succeeds", async () => {
        const response = await supertest(auth).post("/login/mfa").send({
            username: "admin",
            mfa: authenticator.generate(otpKey)
        });

        global.__PRAUXY__ = {
            token: response.body.token,
            group: response.body.group,
            level: 10
        }

        expect(response.statusCode).toBe(200);
        expect(response.body.authenticated).toBe(true);
    })

    it("isAdmin() confirms a users group level", async () => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=asdf:blah:0`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(401);
        expect(response.body.error).toBe("You do not have a high enough group to do this.")
    })

    it("Rejects malformed registration request", async () => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]);

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
    })

    it("User registration works", async () => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
    })

    it("Registration fails if username is taken", async () => {
        const response = await supertest(auth).post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            username: "newUser",
            password: "password123",
            email: "test2@prauxy.app",
            group: 0
        })

        expect(response.statusCode).toBe(409);
        expect(response.body.reason).toBe("username exists");
    })
})

describe("Profile Updates API", () => {
    it("Update email fails due to invalid params", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
    })
    
    it("Update email fails because user does not exist", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
            username: "fake user",
            email: "test-new@prauxy.app"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("user does not exist");
    })
    
    it("Update email succeeds", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "changeemail",
            username: "newUser",
            email: "test-new@prauxy.app"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
    })

    it("Reset password fails due to invalid params", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid params");
    })

    it("Reset password fails because user does not exist", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "fake user",
            old: "password123",
            newp: "password321"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("user does not exist");
    })

    it("Reset password fails because verification of password does not match", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "newUser",
            old: "bad password",
            newp: "password321"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("old pass not right");
    })

    it("Reset password succeeds", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "resetpw",
            username: "newUser",
            old: "password123",
            newp: "password321"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
    })

    it("Deleting a user fails because of an invalid username", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "delete",
            username: "newUsers"
        });

        expect(response.statusCode).toBe(400);
        expect(response.body.status).toBe("fail");
        expect(response.body.reason).toBe("invalid user");
    })

    it("Deleting a user succeeds", async () => {
        const response = await supertest(auth).post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.level};`]).send({
            type: "delete",
            username: "newUser"
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe("complete");
    })
})