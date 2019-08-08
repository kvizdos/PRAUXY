// Install body-parser and Express
const express = require('express')
const app = express()

var httpProxy = require('http-proxy');
var apiProxy = httpProxy.createProxyServer();

var bodyParser = require('body-parser')

// Use req.query to read values!!
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.cookie("authCode", "1234");
    res.send("done")
})


app.listen(8443, () => console.log('Test 2 running on 8443!'))