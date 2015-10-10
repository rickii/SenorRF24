/*
 * *************************************************************************
 * LightSens_Client_Mesh.ino
 *
 * The sketch is an example of connecting an I2C sensor to the Mesh Network.
 * It follows a similar format to other I2C sensors
 *
 * https://github.com/rickii/SensorRF24
 *
 *
 * BH1750FVI Breakout Board (GY-30) Lux value and POST's the data at defined intervals.
 *
 *  UNO
 *     UNO   A4 (SDA)  -  GY-30 (SDA)   SDA
 *     UNO   A5 (SCL)  -  GY-30 (SCL)   SCL
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


#include <Wire.h>
#include <RF24.h>
#include <SPI.h>
#include <RF24Mesh.h>
#include <RF24Network.h>
#include <RF24Ethernet.h>
#if !defined __arm__ && !defined __ARDUINO_X86__
#include <EEPROM.h>
#endif

/*** Configure the radio CE & CS pins ***/
RF24 radio(9, 10);

RF24Network network(radio);
RF24Mesh mesh(radio, network);
RF24EthernetClass RF24Ethernet(radio, network, mesh);

// light sensor
int BH1750_address = 0x23; // i2c Addresse
byte buff[2];
String tempString = "000000";



// The server that the node will send a POST of its sensor data
IPAddress serverUri(10, 10, 2, 2);

const int updateInterval = 10000;      // Time interval in milliseconds to do a sensor read and send an update (number of seconds * 1000 = interval)

// Variable Setup
uint32_t mesh_timer = 0;
long lastConnectionTime = 0;
boolean connectedOnLastAttempt = false;
int failedCounter = 0;


EthernetClient client;

void setup() {

  Serial.begin(115200);
  //  Serial.println("Start");

  //*** Set the IP address for the Node. The last octet will be used as the Node Id. Needs to be in same subnet as Gateway node. ***//
  IPAddress myIP(10, 10, 2, 5);

  Ethernet.begin(myIP);
  Serial.println("Attempting to connect to the RF24 mesh and obtain a mesh address...");
  mesh.begin();
  Serial.print("Connected to the mesh. NodeId is: " + (String)mesh.getNodeID() + " Mesh address is " + "0" + String(mesh.mesh_address, OCT) + " Parent address is " + "0" + String(network.parent(), OCT));

  // If you'll be making outgoing connections from the Arduino to the rest of
  // the world, you'll need a gateway set up.
  // IPAddress gwIP(10,10,2,2);
  // Ethernet.set_gateway(gwIP);

  //*********** Light sensor *************
  Wire.begin();
  BH1750_Init(BH1750_address);

  delay(200);
  //  Serial.println("Light Sensor Mesh");

}

void loop() {

  //delay(2000);

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

  // if we are no longer connected to the HTTP server then stop the client:
  if (!client.connected() && connectedOnLastAttempt)
  {
    Serial.println("Server disconnected. Will stop the client");
    Serial.println();
    client.stop();
    connectedOnLastAttempt = false;
  }

  // See if its time to send an update
  if (!client.connected() && (millis() - lastConnectionTime > updateInterval)) {

    // get value of light sensor
    float valf = 0;
    if (BH1750_Read(BH1750_address) == 2) {

      valf = ((buff[0] << 8) | buff[1]) / 1.2;

      if (valf < 0)Serial.print("> 65535");
      else Serial.print((int)valf, DEC);
      tempString = (String)valf;
    }
  // concatenate all the data into a single string of key value pairs
  String formData = "temperature=" + tempString + "&nodeId=" + (String)mesh.getNodeID() + "&meshAddress=" + "0" + String(mesh.mesh_address, OCT) + "&meshParent=0" + String(network.parent(), OCT);
    Serial.println(formData);
    sendSensorData(formData);
  }
} // end of loop

void sendSensorData(String formData)
{

  if (client.connect(serverUri, 3000))
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
      failedCounter = 0;
    }
    else
    {
      failedCounter++;
      Serial.println("Connection to server failed (" + String(failedCounter, DEC) + ")");
    }

  }
  else
  {
    failedCounter++;
    Serial.println("Connection to server failed (" + String(failedCounter, DEC) + ")");
    lastConnectionTime = millis();
  }
}

void BH1750_Init(int address) {
  Wire.beginTransmission(address);
  Wire.write(0x10); // 1 [lux] aufloesung
  Wire.endTransmission();
}

byte BH1750_Read(int address) {
  byte i = 0;
  Wire.beginTransmission(address);
  Wire.requestFrom(address, 2);
  while (Wire.available()) {
    buff[i] = Wire.read();
    i++;
  }
  Wire.endTransmission();
  return i;
}


