// authorization.test.js

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;

const supertest = require('supertest');
const { authenticator } = require('otplib');
const _CONF = require("../config")

module.exports.tests = (auth) => {
    describe("Authorization API", () => {
        console.log("starting auth tests")

        it("User fails to login with incorrect info", async done => {

            const response = await auth.post("/login").send({
                username: "admin",
                password: "passwords",
                socketid: "test-socket-id"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(401);
            expect(response.body.authenticated).toBe(false);
            done();
        })

        it("User successfully logs in", async done => {
            const response = await auth.post("/login").send({
                username: "admin",
                password: "admin",
                socketid: "test-socket-id"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(200);
            expect(response.body.authenticated).toBe(true);
            done();
        })

        it("Incorrect MFA token fails", async done => {
            const response = await auth.post("/login/mfa").send({
                username: "admin",
                mfa: "123456"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.body.authenticated).toBe(false);
            expect(response.statusCode).toBe(401);
            done();
        })

        it("Correct MFA token succeeds", async done => {
            const response = await auth.post("/login/mfa").send({
                username: "admin",
                mfa: authenticator.generate(global.__PRAUXY_TEST_TFA__)
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            global.__PRAUXY__ = {
                token: response.body.token,
                group: response.body.group,
            }

            expect(response.statusCode).toBe(200);
            expect(response.body.authenticated).toBe(true);
            done();
        })

        it("isAdmin() confirms a users group level", async done => {
            const response = await auth.post("/users/register").set('Cookie', [`prauxyToken=asdf:blah:0`]).send({
                username: "newUser",
                password: "password123",
                email: "test2@prauxy.app",
                group: 0
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(401);
            expect(response.body.error).toBe("You do not have a high enough group to do this.")
            done();
        })

        it("Rejects malformed registration request", async done => {
            const response = await auth.post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("invalid params");
            done();
        })

        it("User registration works", async done => {
            // Create a user for deletion later
            const response2 = await auth.post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                username: "newUser2",
                password: "password123",
                email: "test3@prauxy.app",
                group: 2
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            // Create a secondary admin
            const response3 = await auth.post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                username: "admin2",
                password: "password123",
                email: "test4@prauxy.app",
                group: 10
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            const response = await auth.post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                username: "newUser",
                password: "password123",
                email: "test2@prauxy.app",
                group: 1
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);
            
            MongoClient.connect(url, { useNewUrlParser: true }, function(err, db) {
                let dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

                if (err) throw err;
                dbo.collection("users").findOne({username: "newUser"}, function(err, result) {
                    expect(result.email).toBe("test2@prauxy.app");
                    
                    expect(response.statusCode).toBe(200);
                    expect(response.body.status).toBe("complete");
                    done();
                });
            });
        })

        it("Registration fails if username is taken", async done => {
            const response = await auth.post("/users/register").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                username: "newUser",
                password: "password123",
                email: "test2@prauxy.app",
                group: 0
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(409);
            expect(response.body.reason).toBe("username exists");
            done();
        })

        it("Blocks direct TFA attempts", async done => {
            const response = await auth.post("/login/mfa").send({
                username: "newUser",
                mfa: authenticator.generate(global.__PRAUXY_TEST_TFA_OTHERS__['newUser'])
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(401);
            expect(response.body.reason).toBe("direct tfa")

            done();
        })

        it("New user successfully logs in", async done => {
            const response = await auth.post("/login").send({
                username: "newUser",
                password: "password123",
                socketid: "test-socket-id2"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            const responseForAdmin = await auth.post("/login").send({
                username: "admin2",
                password: "password123",
                socketid: "test-socket-id3"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(200);
            expect(response.body.authenticated).toBe(true);
            
            expect(responseForAdmin.statusCode).toBe(200);
            expect(responseForAdmin.body.authenticated).toBe(true);

            done();
        })

        it("Correct MFA token succeeds for new users", async done => {
            console.log("USING TFA: " + global.__PRAUXY_TEST_TFA_OTHERS__['newUser'])

            const response = await auth.post("/login/mfa").send({
                username: "newUser",
                mfa: authenticator.generate(global.__PRAUXY_TEST_TFA_OTHERS__['newUser'])
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            const loginAdmin = await auth.post("/login/mfa").send({
                username: "admin2",
                mfa: authenticator.generate(global.__PRAUXY_TEST_TFA_OTHERS__['admin2'])
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(loginAdmin.body.reason).toBe(undefined);
            expect(response.statusCode).toBe(200);
            expect(response.body.authenticated).toBe(true);

            expect(loginAdmin.body.reason).toBe(undefined);
            expect(loginAdmin.statusCode).toBe(200);
            expect(loginAdmin.body.authenticated).toBe(true);

            global.__PRAUXY_OTHER_USER__ = {
                token: response.body.token,
                group: response.body.group,
            }
            
            global.__PRAUXY_OTHER_ADMIN__ = {
                token: loginAdmin.body.token,
                group: loginAdmin.body.group,
            }

            done();

        })

    })

    describe("Profile Updates API", () => {
        console.log("starting profile updates")

        it("Update email fails due to invalid params", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "changeemail",
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("invalid params");
            done();
        })
        
        it("Update email fails because user does not exist", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "changeemail",
                username: "fake user",
                email: "test-new@prauxy.app"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("user does not exist");
            done();
        })
        
        it("Update email succeeds", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "changeemail",
                username: "newUser",
                email: "test-new@prauxy.app"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("complete");
            done();
        })

        it("Reset password fails due to invalid params", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "resetpw",
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("invalid params");
            done();
        })

        it("Reset password fails because user does not exist", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "resetpw",
                username: "fake user",
                old: "password123",
                newp: "password321"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("user does not exist");
            done();
        })

        it("Reset password fails because verification of password does not match", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "resetpw",
                username: "newUser",
                old: "bad password",
                newp: "password321"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");  
            expect(response.body.reason).toBe("old pass not right");
            done();
        })

        it("Reset password succeeds", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "resetpw",
                username: "newUser",
                old: "password123",
                newp: "password321"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("complete");
            done();
        })

        it("Deleting a user fails because of an invalid username", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "delete",
                username: "newUsers"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(400);
            expect(response.body.status).toBe("fail");
            expect(response.body.reason).toBe("invalid user");
            done();
        })

        it("Deleting a user succeeds", async done => {
            const response = await auth.post("/users/update").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
                type: "delete",
                username: "newUser2"
            }).set('Host', _CONF.createURL("auth", true)).redirects(1);

            expect(response.statusCode).toBe(200);
            expect(response.body.status).toBe("complete");
            done();
        })
    })
}