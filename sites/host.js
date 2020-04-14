const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;
const _LOGGER = require('../helpers/logging');
const _CONF = require('../config');
const _REDIS = new (require('../helpers/redis'))();

const express = require('express')
const app = express()

const fs = require('fs');
const cheerio = require('cheerio');

app.get("/*", (req, res) => {    
    const regex = new RegExp(_CONF.baseURL.replace(/\./g, '\\.'), 'g');

    const isNotCustom = regex.test(req.headers.host);

    const sendData = (rootDir) => {
        let p = req.params[0] || "index.html";
        if(p.indexOf(".html") >= 0) {
            try {
                const html = fs.readFileSync(`${__dirname}/data/${rootDir}/${p}`, 'utf8');
                const $ = cheerio.load(html);
                const htmlPromo = "<!-- Hosted with Prauxy. Learn more @ https://prauxy.app -->";
                const headerInject = `<link href="https://fonts.googleapis.com/css?family=Open+Sans&display=swap" rel="stylesheet">`;
                const pagePromo = `
                    <style>
                        section#prauxy-promo-card {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            display: flex;
                            align-items: center;
                            background-color: #3f6ae0;
                            width: 100%;
                            padding: 0;
                            font-family: 'Open Sans', sans-serif;
                            justify-content: space-between;

                        }

                        section#prauxy-promo-card a {
                            text-decoration: none;
                            color: white;
                            font-size: 1.25em;
                            padding: 15px;
                            margin: 0;
                        }

                        section#prauxy-promo-card p {
                            color: white;
                            padding: 15px;
                            margin: 0;
                            cursor: pointer;
                        }
                    </style>

                    <script>
                        const closePrauxyPromo = () => {
                            document.getElementById("prauxy-promo-card").remove();
                        }
                    </script>

                    <section id="prauxy-promo-card">
                        <a href="#" target="_blank">This site is hosted with PRAUXY</a>
                        <p onclick="closePrauxyPromo()">close</p>
                    </section>
                `;

                $('html').prepend(htmlPromo);
                $('header').append(headerInject);
                $('body').append(pagePromo);
                
                res.send($.html());
            } catch(e) {
                res.status(404).send("Page not found");
            }
        } else {
            res.sendFile(__dirname + `/data/${rootDir}/${p}`, (err) => {
                if(err) {
                    res.sendStatus(404);
                }
            })
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