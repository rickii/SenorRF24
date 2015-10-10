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
String tempString="000000";

uint32_t mesh_timer = 0;

// HTTP Server Settings
IPAddress serverUri(10,10,2,2);

  // Set the IP address we'll be using. The last octet mast match the nodeID (9)
IPAddress myIP(10, 10, 2, 5); // set this up for your node
const int updateInterval = 10000;      // Time interval in milliseconds to do a sensor read and send an update (number of seconds * 1000 = interval)

// Variable Setup
long lastConnectionTime = 0;
boolean connectedOnLastAttempt = false;
int failedCounter = 0;


EthernetClient client;

void setup() {

  Serial.begin(115200);
//  Serial.println("Start");


  Ethernet.begin(myIP);
  mesh.begin();

  // If you'll be making outgoing connections from the Arduino to the rest of
  // the world, you'll need a gateway set up.
  IPAddress gwIP(10,10,2,2);
  Ethernet.set_gateway(gwIP);

  //*********** Light sensor *************
   Wire.begin();
  BH1750_Init(BH1750_address);
  
  delay(200);
//  Serial.println("Light Sensor Mesh");

}

void loop() {

  float valf=0;
    if(BH1750_Read(BH1750_address)==2){
    
    valf=((buff[0]<<8)|buff[1])/1.2;
    
    if(valf<0)Serial.print("> 65535");
    else Serial.print((int)valf,DEC); 
    tempString = (String)valf;
    }
  delay(2000);

  // Optional: If the node needs to move around physically, or using failover nodes etc.,
  // enable address renewal
  
  if (millis() - mesh_timer > 30000) { //Every 30 seconds, test mesh connectivity
    mesh_timer = millis();
    if ( ! mesh.checkConnection() ) {
      //refresh the network address
      mesh.renewAddress();
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
  
   if ((millis() - lastConnectionTime) > updateInterval) {
    sendSensorData(tempString);
    }
  //else {
  //  Serial.println(" Not ready" );  }


} // end of main

void sendSensorData(String tempString)
{
  // concatenate all the data into a single string of key value pairs
  String formData = "temperature=" + tempString + "&nodeId=" + (String)mesh.getNodeID() + "&meshAddress=" + "0" + String(mesh.mesh_address, OCT) + "&meshParent=0" + String(network.parent(), OCT);
 
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

void BH1750_Init(int address){
  Wire.beginTransmission(address);
  Wire.write(0x10); // 1 [lux] aufloesung
  Wire.endTransmission();
}

byte BH1750_Read(int address){
  byte i=0;
  Wire.beginTransmission(address);
  Wire.requestFrom(address, 2);
  while(Wire.available()){
    buff[i] = Wire.read(); 
    i++;
  }
  Wire.endTransmission();  
  return i;
}


