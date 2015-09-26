var express = require('express');
var app = express();

// For creating the outbound POST request
var request = require('request');

// Parses the post form data
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// For converting an object to a string
var querystring = require('querystring');

// Will use send this as a field for our thingspeak channels
var location = "Gregs Dutch Sensor Network";

// Each thingspeak channel has a seperate api key, this will map between our sensor nodes and the keys.
var thingSpeakChannels = [{_id:4,apiKey:'4BLDCMJ2KGMKCRGN'},{_id:5,apiKey:'11111'}];

// Just some random Latitudes and Longitudes where we pretend our sensors are.
var coords = [{lat:52.069629,long:4.275921},{lat:52.075919,long:4.278144},{lat:52.075694,long:4.288126}];

var thingSpeakUri = 'http://api.thingspeak.com/update';

var getApiKey = function(_id){
    var len = thingSpeakChannels.length;

    for(var i = 0; i<len; i++){
        var item = thingSpeakChannels[i];
        if(item._id == _id) return item.apiKey;
    }

    return false;
};

var server = app.listen(3000,  '10.10.2.2',  function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

app.get('/', function (req, res) {
  res.send('Hello World!');
    console.log("Someone hit ur home page");
});

var getRandomCoords = function(){
    var index = Math.floor((Math.random() * coords.length));
    return coords[index];
};


// accept POST request on the path that sensor will post to
app.post('/api/sensor', function (req, res) {
    console.log("Got a post from " + req.ip);
    if(!req.body.hasOwnProperty('temp') ||
    !req.body.hasOwnProperty('nodeid'))  {
        res.statusCode = 400;
        console.log("POST was bad");
        return res.send('Error 400: Post syntax incorrect.');

    }

    var sensorData = {
        nodeId: req.body.nodeid,
        nodeIpAddress: req.ip,
        temp: req.body.temp
    }
console.log("Got this sensor data from the post" + sensorData.toString());
    res.send('Got a POST request');

    sendToCloud(sensorData);
});

// A function to send sensor data to the thing speak cloud service
var sendToCloud = function(sensorData){
    console.log("Getting sensorData ready for a post");
    if (!sensorData.hasOwnProperty('nodeId')){
        return;
    }

    // Add a location and a random lat long position to the sensorData
    sensorData.location = location;
    var position = getRandomCoords();
    sensorData.lat = position.lat;
    sensorData.long = position.long;

    console.log("sensor data now looks like" + sensorData.toString());

    // Get the thing speak api key for this node
    var apiKey = getApiKey(sensorData.nodeId);

    // Need to replace the key names to thingspeak fields
    sensorData.field1 = sensorData.nodeId;
    sensorData.field2 = sensorData.nodeIpAddress;
    sensorData.field3 = sensorData.temp;
    sensorData.field4 = sensorData.location;

    delete sensorData.nodeId;
    delete sensorData.nodeIpAddress;
    delete sensorData.temp;
    delete sensorData.location;



    // Convert the sensorData to a string
    var formData = querystring.stringify(sensorData);
    var contentLength = formData.length;
    console.log("sensor data is ready to be posted" + formData);
    require('request-debug')(request);
    // send a POST to thingspeak
    request({
        headers: {
            'Content-Length': contentLength,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-THINGSPEAKAPIKEY': apiKey
        },
        uri: thingSpeakUri,
        body: formData,
        method: 'POST'
    }, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            console.log(body)
        }
        else {
            console.log("Thingspeak Error: " + err);
            console.log("Thingspeak response code: " + res.statusCode);
            console.log("the body " + body)
        }
    });
};

