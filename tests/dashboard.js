// authorization.test.js

const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;
const supertest = require('supertest');
const { authenticator } = require('otplib');
const _CONF = require("../config")
const fs = require("fs")
const path = require("path")
const http = require('http');

const dashboardHTML = fs.readFileSync(path.join(__dirname, "..", "dashboard", "frontend", "index.html"), 'utf8')
const authHTML      = fs.readFileSync(path.join(__dirname, "..", "auth", "frontend", "index.html"), 'utf8')

if(process.env.NODE_ENV == "test") {
    http.createServer((req, res) => {
        res.write("This is the test app for the admin user. Everyone should be able to access it, however, since it doesn't require authentication.");
        res.end();
    }).listen(9091);

    http.createServer((req, res) => {
        res.write("This is the test app for the admin user. Only the user admin should be able to access it, however, since it does require authentication.");
        res.end();
    }).listen(9092);

    http.createServer((req, res) => {
        res.write("This is a website with a custom domain! Anyone can access it.");
        res.end();
    }).listen(9093);
}

module.exports.tests = (auth) => {
    it("should get an empty list of applications because it is a new user with no apps", async done => {   
        const response = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.baseURL);   
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.text)).toHaveLength(0)
        done();
    })

    it("it should fail to create an app for the admin user because of invalid params", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.baseURL).send({

        });   
        expect(response.statusCode).toBe(400);
        expect(response.text).toBe("invalid params")
        done();
    })

    it("it should create a new app when it has valid params", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
            name: "Test App",
            short: "test",
            port: 9091
        }).set('Host', _CONF.baseURL).redirects(1);  

        expect(response.statusCode).toBe(302);

        const retrieveApps = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.baseURL);   
        expect(retrieveApps.statusCode).toBe(200);
        
        const apps = JSON.parse(retrieveApps.text);
        expect(apps).toHaveLength(1);
        expect(apps[0].name).toBe("Test App");
        expect(apps[0].requiresAuthentication).toBe(false);

        done();
    })

    it("it should create a new app that requires authentication when it has valid params", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
            name: "Test App 2",
            short: "test2",
            port: 9092,
            ra: "on"
        }).set('Host', _CONF.baseURL).redirects(1);  

        expect(response.statusCode).toBe(302);

        const retrieveApps = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.baseURL);   
        expect(retrieveApps.statusCode).toBe(200);
        
        const apps = JSON.parse(retrieveApps.text);
        expect(apps).toHaveLength(2);
        expect(apps[0].name).toBe("Test App");
        expect(apps[0].requiresAuthentication).toBe(false);
        
        expect(apps[1].name).toBe("Test App 2");
        expect(apps[1].requiresAuthentication).toBe(true);

        done();
    })

    it("it should create a new app with a custom URL and no authentication", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).send({
            name: "Test App 3",
            short: "test3",
            customurl: "blahblah.tld",
            port: 9093,
        }).set('Host', _CONF.baseURL).redirects(1);  

        expect(response.statusCode).toBe(302);

        const retrieveApps = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', _CONF.baseURL);   
        expect(retrieveApps.statusCode).toBe(200);
        
        const apps = JSON.parse(retrieveApps.text);
        expect(apps).toHaveLength(3);
        expect(apps[0].name).toBe("Test App");
        expect(apps[0].requiresAuthentication).toBe(false);
        
        expect(apps[1].name).toBe("Test App 2");
        expect(apps[1].requiresAuthentication).toBe(true);
        
        expect(apps[2].name).toBe("Test App 3");
        expect(apps[2].customURL).toBe("blahblah.tld");
        expect(apps[2].requiresAuthentication).toBe(false);

        done();
    })

    it("it shouldn't let a non-admin user create a new app", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_USER__.token}:newUser:${global.__PRAUXY_OTHER_USER__.group};`]).send({
            name: "This app isnt allowed",
            short: "blah",
            port: 1111
        }).set('Host', _CONF.baseURL); 

        MongoClient.connect(url, { useNewUrlParser: true }, async function(err, db) {
            let dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");

            if (err) throw err;
            dbo.collection("users").findOne({username: "newUser"}, async function(err, result) {
                expect(result.token).toBe(global.__PRAUXY_OTHER_USER__.token);

                expect(response.statusCode).toBe(401);
                expect(response.body.error).toBe("You do not have a high enough group to do this.")
        
                const retrieveApps = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_USER__.token}:newUser:${global.__PRAUXY_OTHER_USER__.group};`]).set('Host', _CONF.baseURL);   
                expect(retrieveApps.statusCode).toBe(200);
                
                const apps = JSON.parse(retrieveApps.text);
                expect(apps).toHaveLength(0);
        
                done();
            });
        });
    })

    it("it should create a new app on a different ADMIN account even when there is nothing running on the port", async done => {   
        const response = await auth.post("/api/new").set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_ADMIN__.token}:admin2:${global.__PRAUXY_OTHER_ADMIN__.group};`]).send({
            name: "Test app with no service",
            short: "noservice",
            port: 9094
        }).set('Host', _CONF.baseURL).redirects(1);  

        expect(response.statusCode).toBe(302);  

        const retrieveApps = await auth.get("/api/all").set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_ADMIN__.token}:admin2:${global.__PRAUXY_OTHER_ADMIN__.group};`]).set('Host', _CONF.baseURL);   
        expect(retrieveApps.statusCode).toBe(200);
        
        const apps = JSON.parse(retrieveApps.text);
        expect(apps).toHaveLength(4);
        expect(apps[3].name).toBe("Test app with no service");
        expect(apps[3].requiresAuthentication).toBe(false);

        done();
    })

}