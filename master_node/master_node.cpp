

#include <RF24/RF24.h>
#include <RF24Network/RF24Network.h>
#include <RF24Mesh/RF24Mesh.h>  
#include <RF24Gateway/RF24Gateway.h>
#include <curl/curl.h>

//RF24 radio(RPI_V2_GPIO_P1_15, BCM2835_SPI_CS0, BCM2835_SPI_SPEED_8MHZ); 
RF24 radio(22,0);
RF24Network network(radio);
RF24Mesh mesh(radio,network);
RF24Gateway gw(radio,network,mesh);

 unsigned long updateRate = 30000;
  
 uint32_t meshInfoTimer = 0;

int main(int argc, char** argv) {

  //Config for use with RF24Mesh as Master Node
  //uint8_t nodeID=0;
   gw.begin();

  //Config for use with RF24Mesh as child Node
  // uint8_t nodeID = 1;
  // gw.begin(nodeID);
 
 
  //Config for use without RF24Mesh
  // uint16_t RF24NetworkAddress = 0; 
  // gw.begin(RF24NetworkAddress);
  
  //Set this to your chosen IP/Subnet
  char ip[] = "10.10.2.2";
  char subnet[] = "255.255.255.0";
  
  gw.setIP(ip,subnet);
  
 while(1){
    
	// The gateway handles all IP traffic (marked as EXTERNAL_DATA_TYPE) and passes it to the associated network interface
	// RF24Network user payloads are loaded into the user cache
	gw.update();
	
  if(millis() - meshInfoTimer > updateRate){
    meshInfoTimer = millis();
  // will get a list of all nodes and send them in a post to a http server
  string nodeIdList = "";
  string nodeAddressList = "";

  for(int i=0; i<mesh.addrListTop; i++){
     nodeIdList = nodeIdList + mesh.addrList[i].nodeID;
     nodeAddressList = nodeAddressList + mesh.addrList[i].address;

      if ((i+1)!=mesh.addrListTop){
        nodeIdList = nodeIdList + ',';
        nodeAddressList = nodeAddressList + ',';
      }
   }

// the curl stuff
  CURL *curl;
  CURLcode res;
 
  /* In windows, this will init the winsock stuff */ 
  curl_global_init(CURL_GLOBAL_ALL);
 
  /* get a curl handle */ 
  curl = curl_easy_init();
  if(curl) {
    /* First set the URL that is about to receive our POST. This URL can
       just as well be a https:// URL if that is what should receive the
       data. */ 
    curl_easy_setopt(curl, CURLOPT_URL, "http://10.10.2.2/api/gateway");
    /* Now specify the POST data */ 
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, "masterNodeId=" + mesh.getNodeID() +"&masterAddress=" + mesh.mesh_address + "&nodeIdList=" + nodeIdList + "&nodeAddressList=" + nodeAddressList);
 
    /* Perform the request, res will get the return code */ 
    res = curl_easy_perform(curl);
    /* Check for errors */ 
    if(res != CURLE_OK)
      fprintf(stderr, "curl_easy_perform() failed: %s\n",
              curl_easy_strerror(res));
 
    /* always cleanup */ 
    curl_easy_cleanup(curl);
  }
  curl_global_cleanup();
}

	if( network.available() ){
	  RF24NetworkHeader header;
		size_t size = network.peek(header);
		uint8_t buf[size];
	    network.read(header,&buf,size);
	  printf("Received Network Message, type: %d id %d \n",header.type,header.id);
	}
 }

  return 0;
}