var express = require('express');
var app = express();

// For creating the outbound POST request
var request = require('request');

// Parses the post form data
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

// For converting an object to a string
var querystring = require('querystring');

// S we can check if a node is responding
var ping = require('ping');

// Will use send this as a field for our thingspeak channels
var location = "Gregs Dutch Sensor Network";

// Each thingspeak channel has a seperate api key, this will map between our sensor nodes and the keys.
var thingSpeakChannels = [{_id: 4, apiKey: '4BLDCMJ2KGMKCRGN'}, {_id: 6, apiKey: 'J7EMRJYR7YIA0Z7N'}];

var thingSpeakNetworkApiKey = 'IXRW2956IFVPC8HY';

// Just some random Latitudes and Longitudes where we pretend our sensors are.
var coords = [{lat: 52.069629, long: 4.275921}, {lat: 52.075919, long: 4.278144}, {lat: 52.075694, long: 4.288126}];

var thingSpeakUri = 'http://api.thingspeak.com/update';

var getApiKey = function (_id) {
    var len = thingSpeakChannels.length;

    for (var i = 0; i < len; i++) {
        var item = thingSpeakChannels[i];
        if (item._id == _id) return item.apiKey;
    }

    return false;
};

var server = app.listen(3000, '10.10.2.2', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Server listening at http://%s:%s', host, port);
});

app.get('/', function (req, res) {
    res.send('Lightweight HTTP server for accepting POSTs from RF24 sensor nodes!');
    console.log("Someone hit the home page");
});

var getRandomCoords = function () {
    var index = Math.floor((Math.random() * coords.length));
    return coords[index];
};


// accept POST request on the path that sensor will post to
app.post('/api/sensor', function (req, res) {
    console.log("Got a post from " + req.ip);
    if (!req.body.hasOwnProperty('temperature') || !req.body.hasOwnProperty('nodeId')) {
        res.statusCode = 400;
        console.log("POST was bad");
        return res.send('Error 400: Post syntax incorrect.');
    }
    console.log('This was the sensors addresses: Address: ' + req.body.meshAddress + ' Parent: ' +req.body.meshParent);
    res.send('Got a POST request');

    var sensorData = {
        field1: req.body.nodeId,
        field2: req.ip,
        field3: req.body.temperature,
        field5: req.body.meshAddress
    }

    console.log("Got this sensor data from the post" + sensorData.toString());

    if (req.body.lat != null && req.body.long != null ){
        sensorData.lat = req.body.lat;
        sensorData.long = req.body.long;
    }
    else{
        // Add a location and a random lat long position to the sensorData
        sensorData.field4 = location;
        var position = getRandomCoords();
        sensorData.lat = position.lat;
        sensorData.long = position.long;
    }

    console.log("sensor data now looks like" + sensorData.toString());

    // Get the thing speak api key for this node
    var apiKey = getApiKey(sensorData.field1);

    // Convert the sensorData to a string
    var formData = querystring.stringify(sensorData);
    sendToThingSpeak(formData, apiKey);
});

var checkNodeAlive = function (networkMap) {
    //var nodeAliveList = [];
    //console.log('how big is the empty array: ' + nodeAliveList.length);
    var nodesCount = networkMap.field2.length;
    var nodesChecked = 0;
    console.log('hoe many nodes to check: ' + nodesCount);

    for (var i = 0; i < nodesCount; i++) {
        var ipAddress = networkMap.field2[i].ipAddress;
        ping.promise.probe(ipAddress)
            .then(function (res) {
                console.log(res);
                for (var i = 0; i < nodesCount; i++) {
                    if (res.host == networkMap.field2[i].ipAddress) {
                        networkMap.field2[i].alive = res.alive;
                    }
                }
                nodesChecked++;
                if (nodesChecked === nodesCount) {
                    // all nodes checked
                    networkMapBuild(networkMap);
                }
            })
            .done();
/*
        ping.sys.probe(ipAddress, function (isAlive) {
            for (var i = 0; i < nodesCount; i++) {
                if (ipAddress == networkMap.field2[i].ipAddress) {
                    networkMap.field2[i].alive = isAlive;
                }
            }
            nodesChecked++;
            if (nodesChecked === nodesCount) {
                // all nodes checked
                networkMapBuild(networkMap);
            }
        });*/
    }

    /*
     networkMap.field6.forEach(function (host) {
     ping.sys.probe(host, function (isAlive) {
     nodeAliveList.push({ipAddress: host, alive: isAlive ? 1 : 0});
     if (nodeAliveList.length == networkMap.field6.length) {
     // all nodes checked

     networkMap.field5 = JSON.stringify(nodeAliveList);
     console.log(networkMap.field5);
     networkMapBuild(networkMap);
     }
     else {
     console.log('must be more nodes to check. list is long: ' + nodeAliveList.length);
     }
     });
     });
     /*
     for (var i = 0; i < networkMap.field6.length; i++) {
     var k = networkMap.field6[i];
     console.log('testing this address: ' + k);
     ping.sys.probe(k, function (isAlive) {
     nodeAliveList.push('ipAddress:'+k+'alive:'+ isAlive ? 1 : 0);
     console.log('node: ' + k + ' is: ' + isAlive ? 'alive' : 'dead');
     if (nodeAliveList.length == networkMap.field6.length){
     // all nodes checked
     networkMap.field5 = nodeAliveList.join(',');
     console.log(networkMap.field5);
     networkMapBuild(networkMap);
     }
     else
     {
     console.log('must be more nodes to check. list is long: ' + nodeAliveList.length);
     }
     });
     }*/
};

var networkMapBuild = function (networkMap) {

    if (networkMap.field2 != null) {
        networkMap.field2 = JSON.stringify(networkMap.field2);
    }
    networkMap.field1 = JSON.stringify(networkMap.field1);
    // Convert the networkMap data to a string
    var formData = querystring.stringify(networkMap);

    sendToThingSpeak(formData, thingSpeakNetworkApiKey);

};

// accept POST request on the path that gateway  will post to
app.post('/api/gateway', function (req, res) {
    console.log("Got a post from " + req.ip);
    if (!req.body.hasOwnProperty('masterNodeId') || !req.body.hasOwnProperty('masterAddress') || !req.body.hasOwnProperty('nodeList')) {
        res.statusCode = 400;
        console.log("POST was bad");
        return res.send('Error 400: Post syntax incorrect.');
    }
    res.send('Got a POST request');

    //console.log(req.body.masterNodeId);
    // console.log(req.body.masterAddress);
    console.log(req.body.nodeList);
    //console.log(req.body.nodeAddressList);

    var networkMap = [];
    networkMap.field1 = {
        id: req.body.masterNodeId,
        address: req.body.masterAddress,
        ipAddress: req.ip
    };
    //networkMap.field2 = req.body.masterAddress;

    var nodeList;
    // Get posted data to a new variable
    if (req.body.nodeList != "") {
        //var tempList = req.body.nodeList.split('||');
        //console.log('templist: ' + tempList);
        nodeList = [].concat(req.body.nodeList.split('||'));

        console.log('There are ' + nodeList.length + ' nodes.');

        for (var i = 0; i < nodeList.length; i++) {
            console.log('Got node: ' + nodeList[i]);
        }

        //var nodeList = req.body.nodeIdList != "" ? req.body.nodeIdList.split('||') : null;
        //var nodeAddressList =  req.body.nodeAddressList != "" ? req.body.nodeAddressList.split(',') : null;

        // We will fill this array with node objects
        var nodes = [];

        var ipAddressMask = req.ip.substring(0, req.ip.lastIndexOf('.') + 1);
        console.log("ip mask" + ipAddressMask);

        for (var i = 0; i < nodeList.length; i++) {
            var node = nodeList[i].split('|');
            console.log('Node is: ' + node);
            nodes.push({id: node[0], address: node[1], ipAddress: ipAddressMask + node[0], alive: false});
        }

        networkMap.field2 = nodes;

        if (nodes.length > 0) {
            checkNodeAlive(networkMap);
        }
    }
    else {
        networkMapBuild(networkMap);
    }
    /*
     if (req.body.nodeIdList != "") {

     var nodeIpAddresses = req.body.nodeIdList.split(',');
     console.log('node list' + nodeIpAddresses);

     for (var i = 0; i < nodeIpAddresses.length; ++i) {
     nodeIpAddresses[i] = ipAddressMask + nodeIpAddresses[i];
     }
     console.log('updated node ip addresses' + nodeIpAddresses);

     networkMap.field6 = [].concat(nodeIpAddresses);
     checkNodeAlive(networkMap);
     }
     else {
     //networkMap.field6 = [];
     networkMapBuild(networkMap);
     }
     */
    /*
     console.log('node alive: ' + nodeAliveList);
     /var networkMap = {};
     networkMap.field1 = req.body.masterNodeId;
     networkMap.field2 = req.body.masterAddress;
     networkMap.field3 = req.body.nodeIdList;
     networkMap.field4 = req.body.nodeAddressList;
     networkMap.field5 = nodeAliveList.join(',');

     console.log('alive list: ' + networkMap.field5);

     // Convert the networkMap data to a string
     var formData = querystring.stringify(networkMap);

     sendToThingSpeak(formData, thingSpeakNetworkApiKey);*/

});


// A function to send data to the thing speak cloud service
var sendToThingSpeak = function (formData, apiKey) {

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

