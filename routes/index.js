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
    var dt = new Date();
    res.send(dt.getSeconds().toString());
});


module.exports = router;
