// express is used for handling incoming GET and POST request
var express = require('express');
var app = express();

// request is used for creating the outbound POST request
var request = require('request');

// bodyParse is used to parse the body from the POST request
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

// queryString is used to convert an object into a HTML encoded string
var queryString = require('querystring');

// ping is used to check if a node is responding
var ping = require('ping');

// Each thingspeak channel has a separate api key, this array allows us to map between our sensor Node Id and the api key.
var thingSpeakChannels = [{_id: 65, apiKey: '4BLDCMJ2KGMKCRGN'}, {_id: 150, apiKey: 'J7EMRJYR7YIA0Z7N'}];

// This is a thing speak channel that is used to display all nodes in a network.
var thingSpeakNetworkApiKey = 'IXRW2956IFVPC8HY';

// Just some random Latitudes and Longitudes where we can pretend our sensors are.
var coords = [{lat: 52.069629, long: 4.275921}, {lat: 52.075919, long: 4.278144}, {lat: 52.075694, long: 4.288126}];

// The Uri that we POST updates to thing speak
var thingSpeakUri = 'http://api.thingspeak.com/update';


/*
 *   Here we create the Express http server
 *
 *   Set the IP to an empty string to bind to all IP adresses on the RpI
 *
 */
var server = app.listen(3000, '10.10.2.2', function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Express HTTP Server listening at http://%s:%s', host, port);
});

/*
 *   Add a route to the root of the server.
 *
 */
app.get('/', function (req, res) {
    res.send('Lightweight HTTP server for accepting POSTs from RF24 sensor nodes!');
    // console.log("Someone hit the home page");
});


/*
 *   Add a route to accept POST requests from the RF24 nodes
 *
 *   The RF24 node must send a POST request with the form data having keys:
 *       temperature
 *       nodeId
 *       meshAddress
 *
 *   The node can also send these keys:
 *       lat
 *       long
 *
 */
app.post('/api/sensor', function (req, res) {
    // console.log("Got a post from " + req.ip);
    if (!req.body.hasOwnProperty('temperature') || !req.body.hasOwnProperty('nodeId') || !req.body.hasOwnProperty('meshAddress')) {
        res.statusCode = 400;
        console.log("POST was bad");
        return res.send('Error 400: Post syntax incorrect.');
    }
    res.send('POST request accepted');

    processSensorData(req);
});

/*
 *   Add a route to accept POST requests from the RF24 master gateway
 *
 *   The RF24 master gateway node must must send a POST request with the form data having keys:
 *       masterNodeId
 *       masterAddress
 *       nodeList
 *
 */
app.post('/api/gateway', function (req, res) {
    //console.log("Got a post from " + req.ip);
    if (!req.body.hasOwnProperty('masterNodeId') || !req.body.hasOwnProperty('masterAddress') || !req.body.hasOwnProperty('nodeList')) {
        res.statusCode = 400;
        //console.log("POST was bad");
        return res.send('Error 400: Post syntax incorrect.');
    }
    res.send('POST request accepted');

    processGatewayData(req);
});

/*
 *   A function to process data received from a RF24 sensor node
 *
 */
var processSensorData = function (requestData) {
    // Build an object of relevant data from the request
    // The field numbers directly refer to the fields setup on thing speak
    var sensorData = {
        field1: requestData.body.nodeId,
        field2: requestData.ip,
        field3: requestData.body.temperature,
        field5: requestData.body.meshAddress
    }
    // If the node sent lat and long then use it otherwise mock it
    if (requestData.body.lat != null && requestData.body.long != null) {
        sensorData.lat = requestData.body.lat;
        sensorData.long = requestData.body.long;
    }
    else {
        var position = getRandomCoords();
        sensorData.lat = position.lat;
        sensorData.long = position.long;
    }

    // Get the thing speak api key for this node
    var apiKey = getApiKey(sensorData.field1);

    // Convert the sensorData to a HTML string
    var formData = queryString.stringify(sensorData);

    // Pass the data to the send method
    sendToThingSpeak(formData, apiKey);
};

/*
 *   A function to process the data received from the RF24 gateway node
 */
var processGatewayData = function (requestData) {

    // We create a networkMap object that will hold our master and child nodes
    var networkMap = [];
    networkMap.field1 = {
        id: requestData.body.masterNodeId,
        address: requestData.body.masterAddress,
        ipAddress: requestData.ip
    };

    var nodeList;
    // Check that there is actually some nodes
    if (requestData.body.nodeList != "") {

        // Add all the nodes to an empty array, split the list on each '||'
        nodeList = [].concat(requestData.body.nodeList.split('||'));

        // Get the first 3 octets of the gateways ip address.
        // The IP address of a node is the the mask plus the Node Id
        var ipAddressMask = requestData.ip.substring(0, requestData.ip.lastIndexOf('.') + 1);

        // We will fill this array with node objects
        var nodes = [];

        // Add each of the nodes to a node object and push it into the nodes array
        for (var i = 0; i < nodeList.length; i++) {
            var node = nodeList[i].split('|');
            // id is the Node Id. add is the node address. ip is the nodes IP address. act is a flag for active
            nodes.push({id: node[0], add: node[1], ip: ipAddressMask + node[0], act: 0});
        }

        // add the nodes array to the networkMap
        networkMap.field2 = nodes;

        // If we have some nodes then pass the networkMap to a function to check if each node is active
        if (nodes.length > 0) {
            checkNodeAlive(networkMap);
        }
    }
    else { // We don't have any nodes so go direct to the map builder
        networkMapBuild(networkMap);
    }
};


/*
 *   A function that accepts a networkMap object and attempts a ping on each node in the
 *      network map, updates the networkMap with the result of the ping attempt.
 *
 *      After all nodes have been checked passes the networkMap to a function to
 *      ready it for POSTing to thing speak.
 *
 */
var checkNodeAlive = function (networkMap) {
    var nodesCount = networkMap.field2.length;
    var nodesChecked = 0;

    for (var i = 0; i < nodesCount; i++) {
        var ip = networkMap.field2[i].ip;
        ping.promise.probe(ip)
            .then(function (res) {
                //console.log(res);
                for (var i = 0; i < nodesCount; i++) {
                    if (res.host == networkMap.field2[i].ip) {
                        networkMap.field2[i].act = res.alive ? 1 : 0;
                    }
                }
                nodesChecked++;
                if (nodesChecked === nodesCount) {
                    // all nodes checked
                    networkMapBuild(networkMap);
                }
            })
            .done();
    }
};

/*
 *   A function that takes networkMap of all the nodes in the mesh network
 *   and prepares it to be POSTed to thing speak.
 *
 */
var networkMapBuild = function (networkMap) {

    // Check if there are any nodes in field2
    if (networkMap.field2 != null) {
        //Strip the ip address field from each node to make the object smaller
        for (var i = 0; i < networkMap.field2.length; i++) {
            delete networkMap.field2[i].ip;
        }

        var usedFieldCount = 2;
        // We can only send 6 nodes in each field due to a 400 character limit by thing speak.
        // So we break them up into seperate fields. The limit is 6fields x 5 nodes = 36.
        // Any more than 36 nodes are thrown away and not uploaded to thing speak.
        while (networkMap.field2.length > 6) {
            networkMap['field' + (usedFieldCount + 1)] = networkMap.field2.splice(6, networkMap.field2.length - 6);
            // Convert the node object to a string representation of the object
            networkMap['field' + (usedFieldCount + 1)] = JSON.stringify(networkMap['field' + (usedFieldCount + 1)]);
            usedFieldCount++;
            if (usedFieldCount == 8) {
                // just remove the rest of the nodes as thing speak cant store them
                networkMap.field2.splice(6, networkMap.field2.length);
            }
        }

        // Convert the node object to a string representation of the object
        networkMap.field2 = JSON.stringify(networkMap.field2);
    }
    // Convert the master node object to a string representation of the object
    networkMap.field1 = JSON.stringify(networkMap.field1);

    // Convert the networkMap data to a HTML encoded string
    var formData = queryString.stringify(networkMap);

    // Send the network data to thing speak
    sendToThingSpeak(formData, thingSpeakNetworkApiKey);
};

/*
 *   A function to send data to the thing speak cloud service.
 *
 *   Takes a HTML formatted string and an apiKey and
 *   builds a POST request using the 'request' library
 *
 */
var sendToThingSpeak = function (formData, apiKey) {

    var contentLength = formData.length;

    // Uncomment this line to get debug output to the console to help troubleshoot requests
    //require('request-debug')(request);
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
       /* if (!err && res.statusCode == 200) {
            // console.log(body)
        }
        else {
            //console.log("Thingspeak Error: " + err);
            //console.log("Thingspeak response code: " + res.statusCode);
            // console.log("Response body: " + body)
        }*/
    });
};

/*
 *   A function that takes a Node Id and finds the matching apiKey
 *   from the thingSpeakChannels array
 *
 */
var getApiKey = function (_id) {
    var len = thingSpeakChannels.length;

    for (var i = 0; i < len; i++) {
        var item = thingSpeakChannels[i];
        if (item._id == _id) return item.apiKey;
    }

    return false;
};

/*
 *   A function that returns a random set
 *   of coordinates from the coords array
 *
 */
var getRandomCoords = function () {
    var index = Math.floor((Math.random() * coords.length));
    return coords[index];
};
