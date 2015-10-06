/*
 * *************************************************************************
 * arduino_node.ino
 *
 * Arduino Micro with nRF24 wireless used as a sensor node with a MPC9701 
 * temperature sensor.
 *
 *
 * Reads temperature value and POST's the data at defined intervals.
 *
 * *************************************************************************
 *
 *
 * This program adapted from code from TMRh20 https://github.com/TMRh20/RF24Ethernet/blob/master/examples/Getting_Started_SimpleClient_Mesh/Getting_Started_SimpleClient_Mesh.ino
 * RF24Ethernet uses the fine uIP stack by Adam Dunkels <adam@sics.se>
 *
 * In order to minimize memory use and program space:
 * 1. Open the RF24Network library folder
 * 2. Edit the RF24Networl_config.h file
 * 3. Un-comment #define DISABLE_USER_PAYLOADS
 *
 * Configuration Needed
 * 1. Set the connected CE and CSN pins for the nRF24
 * 2. Set an IP Address for this node in the same subnet as the master node
 * 3. Set the IP Address of the lightweight HTTP server that accepts the POST requests.
 * 4. Set the update interval
 *
 */



#include <RF24.h>
#include <SPI.h>
#include <RF24Mesh.h>
#include <RF24Network.h>
//#include <printf.h>
#include <RF24Ethernet.h>
#if !defined __arm__ && !defined __ARDUINO_X86__
#include <EEPROM.h>
#endif

/*** Configure the radio CE & CS pins ***/
RF24 radio(9, 10);
RF24Network network(radio);
RF24Mesh mesh(radio, network);
RF24EthernetClass RF24Ethernet(radio, network, mesh);


EthernetClient client;

void setup() {

  delay(5000);
  Serial.begin(9600);
  // printf_begin();
  Serial.println("Start");

  //*** Set the IP address for the Node. The last octet will be used as the Node Id. Needs to be in same subnet as Gateway node. ***//
  IPAddress myIP(10, 10, 2, 150);

  Ethernet.begin(myIP);
  Serial.println("Attempting to connect to the RF24 mesh and obtain a mesh address...");
  mesh.begin();
  Serial.print("Connected to the mesh. NodeId is: " + (String)mesh.getNodeID() + " Mesh address is " + "0" + String(mesh.mesh_address, OCT) + " Parent address is " + "0" + String(network.parent(), OCT));

  // If you'll be making outgoing connections from the Arduino to the rest of
  // the world, you'll need a gateway set up.
  //IPAddress gwIP(10,10,2,2);
  //Ethernet.set_gateway(gwIP);
}

uint32_t counter = 0;
uint32_t reqTimer = 0;

uint32_t mesh_timer = 0;

// The server that the node will send a POST of its sensor data
IPAddress httpServer(10, 10, 2, 2);

// Time interval in milliseconds to do a sensor read and send an update (number of seconds * 1000 = interval)
const int updateInterval = 20 * 1000;

// Variables to control connection to server
long lastConnectionTime = 0;
boolean connectedOnLastAttempt = false;
int failedCounter = 0;

//String nodeId = (String)4;      // This will be sent with the POST data to help identify this node

void loop() {

  // Optional: If the node needs to move around physically, or using failover nodes etc.,
  // enable address renewal
  if (millis() - mesh_timer > 30000) { //Every 30 seconds, test mesh connectivity
    mesh_timer = millis();
    Serial.println("Testing mesh connection");
    if ( ! mesh.checkConnection() ) {
      //refresh the network address
      Serial.println("Not connected to mesh. Will attempt reconnect...");
      mesh.renewAddress();
      Serial.print("Connected to the mesh. NodeId is: " + (String)mesh.getNodeID() + " Mesh address is " + "0" + String(mesh.mesh_address, OCT));
    }

    if (mesh.checkConnection()) {
      Serial.println("Connected to mesh");
    }
  }

  size_t size;

  // Get incoming data
  if (size = client.available() > 0) {
    char c = client.read();
    Serial.print(c);
  }

  // if we are no longer connected to the server's then stop the client:
  if (!client.connected() && connectedOnLastAttempt)
  {
    Serial.println("Server disconnected. Will stop the client");
    Serial.println();
    client.stop();
    connectedOnLastAttempt = false;
  }

  // See if its time to send an update
  if (!client.connected() && (millis() - lastConnectionTime > updateInterval)) {
    Serial.println("Time to send an update");

    // Setup up sensor variables
    int temperatureSensorPin = A0;  // The pin the temp sesnor is connected to
    int temperatureSensorValue = 0; // variable to store the value coming from the sensor
    int tempWholePart = 0;          // The whole part of the temperature
    int tempFractPart = 0;          // The fractional part of the temperature
    String tempString = "";         // The string reresenation of the temperature

    // Get 10 readings of the temperature sensor and average them
    for (byte i = 0; i < 10; i++)
    {
      temperatureSensorValue += analogRead(temperatureSensorPin);
    }
    temperatureSensorValue = temperatureSensorValue / 10;

    // Adjust the sensor value and get the whole and fractional parts
    temperatureSensorValue = 25 *  temperatureSensorValue - 2050;
    tempWholePart = temperatureSensorValue / 100;
    tempFractPart = temperatureSensorValue % 100;

    // Put the whole and fractional parts of the temp together in a string
    tempString = (String)tempWholePart + ".";
    if (tempFractPart  < 10)
    {
      tempString = tempString + "0";
    }
    tempString = tempString + (String)tempFractPart;

    Serial.println("Temperature: " + tempString);

    // Pass the temperature to the the sendSensorData method
    sendSensorData(tempString);
  }
  // We can do other things in the loop, but be aware that the loop will
  // briefly pause while IP data is being processed.
}

void sendSensorData(String tempString)
{
  // concatenate all the data into a single string of key value pairs tht can be sent in the POST
  String formData = "temperature=" + tempString + "&nodeId=" + (String)mesh.getNodeID() + "&meshAddress=" + "0" + String(mesh.mesh_address, OCT) + "&meshParent=0" + String(network.parent(), OCT);
  Serial.println("Data to send: " + formData);

  if (client.connect(httpServer, 3000))
  {
    client.print("POST /api/sensor HTTP/1.1\n");
    client.print("Host: 10.10.2.2\n");
    client.print("Connection: close\n");
    client.print("Content-Type: application/x-www-form-urlencoded\n");
    client.print("Content-Length: ");
    client.print(formData.length());
    client.print("\n\n");

    client.print(formData);

    lastConnectionTime = millis();

    if (client.connected())
    {
      connectedOnLastAttempt = client.connected();
      Serial.println("POSTing data...");
      Serial.println();

      failedCounter = 0;
    }
    else
    {
      failedCounter++;

      Serial.println("Connection to server failed (" + String(failedCounter, DEC) + ")");
      Serial.println();
    }

  }
  else
  {
    failedCounter++;

    Serial.println("Connection to server failed (" + String(failedCounter, DEC) + ")");
    Serial.println();

    lastConnectionTime = millis();
  }
}

