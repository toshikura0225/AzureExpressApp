'use strict';
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {

    const fs = require('fs');
    let text = "T.K";
    fs.writeFileSync("output.txt", text);
    text = fs.readFileSync("output.txt");
    //console.log(text);

    res.render('index', { title: text });
});

router.get('/temperature', function (req, res) {
    res.send(temperature);
});

var temperature = null;
router.get('/set', function (req, res) {
    if (typeof req.query.temp !== "undefined")
    {
        temperature = req.query.temp;
    }
    res.send("OK");
});

setInterval(() => {


}, 1000);

module.exports = router;
