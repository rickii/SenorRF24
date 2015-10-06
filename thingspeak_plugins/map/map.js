<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.4.4/jquery.min.js"></script>
<script type="text/javascript" src="https://maps.google.com/maps/api/js?sensor=false"></script>
<script type="text/javascript">
    var channelId = window.parent.location.pathname.match(/\d+/g);
    var loadData = function(){
        $.getJSON("https://api.thingspeak.com/channels/" + channelId + "/feed/last.json?location=true", function(data)
        {
            var coords = new google.maps.LatLng(parseFloat(data.latitude), parseFloat(data.longitude));
            var mapOptions = { zoom: 12, center: coords, mapTypeControl: true, mapTypeId: google.maps.MapTypeId.ROADMAP };
            map = new google.maps.Map(document.getElementById("map"), mapOptions);
            var marker = new google.maps.Marker({ position: coords, map: map, title: "Last Location" });
            var lastReadTime = new Date(data.created_at);
            var contentString = 'Position at: ' + lastReadTime.toLocaleDateString() + ' ' + lastReadTime.toLocaleTimeString() + '<br>' +'Temperature: ' + data.field3;
            var infowindow = new google.maps.InfoWindow({
                content: contentString
            });

            marker.addListener('click', function() {
                infowindow.open(map, marker);
            });




        });
    }
    loadData();

    setInterval('loadData()', 15000);

</script>