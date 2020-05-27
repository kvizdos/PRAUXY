const speedTest = require('speedtest-net');
const _MongoConfig = require('../helpers/mongo');
const MongoClient = require('mongodb').MongoClient;
const url = _MongoConfig.url;
const _LOGGER = require('../helpers/logging');

async function getCurrentSpeed() {
    try {
        var test = await speedTest({acceptLicense: true});
        return test;
    } catch (err) {
        console.log(err)
    }
}

async function readSpeeds() {
    const speeds = await getCurrentSpeed();
    const downloadMbps = Math.floor(speeds.download.bandwidth / 100000)
    const uploadMbps = Math.floor(speeds.upload.bandwidth / 100000);

    MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
        var dbo = db.db(process.env.NODE_ENV == 'test' ? "prauxy-test" : "homerouter");
        _LOGGER.log(`Download: ${downloadMbps} Mbps - Upload: ${uploadMbps}`, "Speedtest")
        dbo.collection("speedtests").insertOne({download: downloadMbps, uploadMbps: uploadMbps, time: (+ new Date)});
    });

}

exports.getSpeed = readSpeeds;
