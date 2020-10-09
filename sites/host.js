const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;
const _LOGGER = require('../helpers/logging');
const _CONF = require('../config');
const _REDIS = new (require('../helpers/redis'))();
const cheerio = require('cheerio');
const fs = require('fs');

const express = require('express')
const app = express()

function parseCookies (request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

function splitABCookie(str) {
    isValid = str.length % 6 == 0
    
    if(isValid) {
        formed = [];

        for(let i = 0; i < str.length; i += 6) {
            formed.push(str.slice(i, i + 6));
        }

        return formed
    }

    return "INVALID COOKIE"
}

app.get("/*", (req, res) => {    
    const regex = new RegExp(_CONF.baseURL.replace(/\./g, '\\.'), 'g');

    const isNotCustom = regex.test(req.headers.host);

    const sendData = (rootDir, abRules) => {
        if(req.params[0] != "" && !req.params[0].endsWith("/") && req.params[0].indexOf(".") !== -1) {
            res.sendFile(__dirname + `/data/${rootDir}/${req.params[0]}`, (err) => {
                if(err) {
                    res.sendStatus(404);
                }
            })
        } else {
            try {
                const path = "/" + req.params[0];
                const html = fs.readFileSync(__dirname + `/data/${rootDir}/${req.params[0].indexOf(".") > 0 ? req.params[0] : req.params[0] + "/index.html"}`);
                const $ = cheerio.load(html);
                const banner = `
                <section id="prauxy-branding-banner">
                    <a href="https://prauxy.app/?utm_source=insertedbanner" target="_blank">
                        <p>Powered by</p>
                        <img src="https://prauxy.app/assets/textlogo-white.svg" />
                    </a>
                    <p class="prclose" onclick="document.getElementById('prauxy-branding-banner').remove()" role="button" aria-pressed="false">&times;</p>
                </section>
                `

                const css = `
                <style>
                #prauxy-branding-banner {
                    background-color: rgb(38, 103, 224);
                    display: flex;
                    align-items: center;
                    color: white;
                    text-transform: uppercase;
                    font-family: 'PT Sans', sans-serif;
                    font-weight: bold;
                    justify-content: space-between;
                    position: relative;
                }
         
                #prauxy-branding-banner a {
                    display: flex;
                    align-items: center;
                    text-decoration: none;
                    color: white;
                    padding: 0;
                }
         
                #prauxy-branding-banner p {
                    margin: 0;
                    margin-top: 4px;
                    color: white;
                    padding: 15px;
                }
         
                #prauxy-branding-banner a img {
                    height: 20px;
                    margin-left: 10px;
                }
         
                #prauxy-branding-banner p.prclose {
                    font-size: 24px;
                    margin: 0;
                    padding: 15px;
                    cursor: pointer;
                }    
                </style>
                `

                // $('head').append(css);
                // $('body').prepend(banner);

                const cookies = parseCookies(req);

                let setGlobalTrackingIDs = []

                if(abRules[path] != undefined) {
                    let currentlyEnrolledABs = cookies.prauxyabs || ["."];                    
                    if(currentlyEnrolledABs[0] != ".") currentlyEnrolledABs = splitABCookie(currentlyEnrolledABs)
                    let resetCookie = false;
                    if(currentlyEnrolledABs == "INVALID COOKIE") {
                        resetCookie = true;
                    }

                    let currentCookies = resetCookie == false ? cookies.prauxyabs || "" : ""

                    for(let { selector, abA, abB, idA, idB } of abRules[path]) {
                        const useA = currentlyEnrolledABs.includes(idA) ? true : currentlyEnrolledABs.includes(idB) ? false : (Math.floor(Math.random() * 2) + 1) == 1;

                        if(useA && !currentlyEnrolledABs.includes(idA)) {
                            currentCookies = currentCookies + idA;
                            res.cookie("prauxyabs", currentCookies);
                        } else if(!useA && !currentlyEnrolledABs.includes(idB)) {
                            currentCookies = currentCookies + idB;
                            res.cookie("prauxyabs", currentCookies);
                        }

                        setGlobalTrackingIDs.push(useA ? idA : idB);

                        $(selector).text(useA ? abA : abB);
                    }
                }

                $('body').append(`
                <script>
                    window.prauxyabs = ${JSON.stringify(setGlobalTrackingIDs)}
                </script>
                `)

                res.send($.html());
            } catch(e) {
                res.sendStatus(404);
            }
        }
    }

    _REDIS.get(`SITE:${req.headers.host}`).then(r => {
        if(r != null) {
            r = JSON.parse(r);
            sendData(r.root, r.abs)
        } else {
            MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
                var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
                let query = isNotCustom ? {shortName: req.headers.host.split(".")[0].split("-")[1]} : {customURL: req.headers.host}
                dbo.collection("sites").findOne(query, (err, result) => {
                    if(err) console.log(err)
                    if(result == null) {
                        return res.status(404).redirect("/404");
                    } else {
                        console.log("inh here")
                        _REDIS.set(`SITE:${req.headers.host}`, JSON.stringify({root: result.root, abs: result.abRules}));
                        sendData(result.root, result.abRules)
                    }
                });
            });
        }
    })
})

app.listen(_CONF.ports.siteLauncherHost, () => _LOGGER.log("Started", "Site Launcher Host"))