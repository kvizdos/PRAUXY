// authorization.test.js

const supertest = require('supertest');
const { authenticator } = require('otplib');
const _CONF = require("../config")
const fs = require("fs")
const path = require("path")

const dashboardHTML = fs.readFileSync(path.join(__dirname, "..", "dashboard", "frontend", "index.html"), 'utf8')
const authHTML      = fs.readFileSync(path.join(__dirname, "..", "auth", "frontend", "index.html"), 'utf8')


module.exports.tests = (auth) => {
    it("Should reroute a user to the authorization page when they are unauthorized", async done => {   
        const response = await auth.get("/").set('Host', _CONF.baseURL);   
        expect(response.header.location).toBe(_CONF.createURL("auth"))
        expect(response.statusCode).toBe(302);
        done();
    })
    
    it("Should allow an authorized user to access the dashboard", async done => {   
        const response = await auth.get("/").set('Host', _CONF.baseURL).set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]);   
        expect(response.text).toBe(dashboardHTML)
        expect(response.statusCode).toBe(200);

        const response2 = await auth.get("/").set('Host', _CONF.baseURL).set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_USER__.token}:newUser:${global.__PRAUXY_OTHER_USER__.group};`]);
        expect(response2.text).toBe(dashboardHTML)
        expect(response2.statusCode).toBe(200);

        done();
    })

    it("Should 404 an invalid URL", async done => {
        const response = await auth.get("/").set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).set('Host', "notagoodsite.com").redirects(1);

        expect(response.statusCode).toBe(404);
        expect(response.text).toBe("Invalid PRAUXY Route")
        done();
    })

    it("Should route a user to the authentication server if they have the right URL and subdomain but are not logged in", async done => {
        const response = await auth.get("/").set('Host', _CONF.baseURL).redirects(1);

        expect(response.text).not.toBe("Invalid PRAUXY Route");
        expect(response.text).toBe(authHTML)
        expect(response.statusCode).toBe(200);
        done();
    })

    it("Should let anyone access an app that doesn't require authentication", async done => {
        const response = await auth.get("/").set('Host', _CONF.createURL("test", true)).redirects(1);

        expect(response.text).toBe("This is the test app for the admin user. Everyone should be able to access it, however, since it doesn't require authentication.");
        expect(response.statusCode).toBe(200);
        
        done();
    })

    it("Shouldn't allow anyone except the 'admin' user to access the route 'test2' since it requires authentication.", async done => {
        const noCookiesTest = await auth.get("/").set('Host', _CONF.createURL("test2", true)).redirects(1);

        expect(noCookiesTest.text).toBe(authHTML);
        expect(noCookiesTest.statusCode).toBe(200);
        
        const withAnInvalidUser = await auth.get("/").set('Host', _CONF.createURL("test2", true)).set('Cookie', [`prauxyToken=${global.__PRAUXY_OTHER_USER__.token}:admin:${global.__PRAUXY_OTHER_USER__.group};`]).redirects(1);
        
        expect(withAnInvalidUser.text).toBe(authHTML);
        expect(withAnInvalidUser.statusCode).toBe(200);
        
        const withValidUser = await auth.get("/").set('Host', _CONF.createURL("test2", true)).set('Cookie', [`prauxyToken=${global.__PRAUXY__.token}:admin:${global.__PRAUXY__.group};`]).redirects(1);
        
        expect(withValidUser.text).toBe("This is the test app for the admin user. Only the user admin should be able to access it, however, since it does require authentication.");
        expect(withValidUser.statusCode).toBe(200);

        done();
    })

    it("Should let anyone access an app that uses a custom URL", async done => {
        const response = await auth.get("/").set('Host', "blahblah.tld").redirects(1);

        expect(response.text).toBe("This is a website with a custom domain! Anyone can access it.");
        expect(response.statusCode).toBe(200);
        
        done();
    })

    it("Should 504 a user when they go to a valid route that isn't running an app.", async done => {
        const response = await auth.get("/").set('Host', _CONF.createURL("noservice", true)).redirects(1);

        expect(response.text).toBe("ECONNREFUSED");
        expect(response.statusCode).toBe(502);
        
        done();
    })
}