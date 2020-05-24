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

app.get("/*", (req, res) => {    
    const regex = new RegExp(_CONF.baseURL.replace(/\./g, '\\.'), 'g');

    const isNotCustom = regex.test(req.headers.host);

    const sendData = (rootDir) => {
        if(!req.params[0].endsWith("/") && req.params[0].indexOf(".") !== 0) {
            console.log("here = " + (req.params[0] != ""));
            res.sendFile(__dirname + `/data/${rootDir}/${req.params[0]}`, (err) => {
                if(err) {
                    res.sendStatus(404);
                }
            })
        } else {
            try {
                console.log(__dirname + `/data/${rootDir}/${req.params[0] || "index.html"}`)
                const html = fs.readFileSync(__dirname + `/data/${rootDir}/${req.params[0] == "/" || req.params[0] == "" || req.params[0] == null || req.params[0] == undefined ? "index.html" : "/" + req.params[0]}`);
                const $ = cheerio.load(html);
                const banner = `
                <section id="prauxy-branding-banner">
                    <a href="https://prauxy.app" target="_blank">
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

                $('head').append(css);
                $('body').prepend(banner);

                res.send($.html());
            } catch(e) {
                console.log(e);
                res.sendStatus(404);
            }
        }
    }

    _REDIS.get(`SITE:${req.headers.host}`).then(r => {
        if(r != null) {
            sendData(r)
        } else {
            MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
                var dbo = db.db("homerouter");
                let query = isNotCustom ? {shortName: req.headers.host.split(".")[0].split("-")[1]} : {customURL: req.headers.host}
                dbo.collection("sites").findOne(query, (err, result) => {
                    if(err) console.log(err)
                    if(result == null) {
                        return res.status(404).redirect("/404");
                    } else {
                        _REDIS.set(`SITE:${req.headers.host}`, result.root);
                        sendData(result.root)
                    }
                });
            });
        }
    })
})

app.listen(_CONF.ports.siteLauncherHost, () => _LOGGER.log("Started", "Site Launcher Host"))