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
        const p = req.params[0] || "index.html";
        res.sendFile(__dirname + `/data/${rootDir}/${p}`, (err) => {
            if(err) {
                res.sendStatus(404);
            }
        })
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