<script type='text/javascript' src='https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js'></script>
<script type='text/javascript' src='https://www.google.com/jsapi'></script>
<script type='text/javascript'>
    var chart;
    var data;

    google.load('visualization', '1', {packages: ['orgchart']});
    google.setOnLoadCallback(initChart);

    function displayData(sensorData) {

        if (data.getNumberOfRows()) {
            data.removeRows(0, 255);
        }
        data.addRows(sensorData);
        chart.draw(data, options);
    }

    function loadData() {

        var networkMap = [];
        var channel_id = window.parent.location.pathname.match(/\d+/g);
        $.getJSON('https://api.thingspeak.com/channels/' + channel_id + '/feed/last.json?key=ABJV25NX3ENQOAM4', function (data) {
            var created_at = data.created_at;
            var master;
            var nodes;
            if (data!=null){ // Check that there is some data in this feed
                if (data.field1 !=null){
                    master = JSON.parse(data.field1);
                }
                if (data.field2 != null){
                    nodes = JSON.parse(data.field2);
                }
                // check the other fields for nodes
                for (var i=4; i< Object.keys(data).length; i++){
                    var fieldName = Object.keys(data)[i];
                    if (data[fieldName] != null){
                        var fieldValue = data[fieldName];
                        var newNodes = JSON.parse(fieldValue);
                        nodes = nodes.concat(newNodes);
                    }
                }
            }

            networkMap.push([{
                v: master.address,
                f: 'Master\nNode Id: ' + master.id + '\nAddress: ' + master.address
            }, '', 'Node Id: ' + master.id + '\nAddress: ' + master.address]);

            if (nodes !=null && nodes.length >= 1) {
                for (var index = 0; index < nodes.length; ++index) {
                    var node = nodes[index];
                    // Determine the parent for this node: example node 043 has parent 03. node 0125 has parent 025
                    var parent = node.add.substring(2, node.add.length);
                    parent = "0" + parent;
                    if (parent.length == 1) {
                        parent = "0" + parent;
                    }

                    node.parent = parent;
                    node.act = node.act ? 'Yes' : 'No';

                    networkMap.push([{
                        v: node.add,
                        f: 'Node Id: ' + node.id + '\nAddress: ' + node.add + '<br><div><span>Alive: </span><span style="color:red; font-weight:bold">' + node.act + '</span></div>'
                    }, node.parent, 'Node Id: ' + node.id + '\nAddress: ' + node.add]);
                }
            }
            displayData(networkMap);
        });
    }

    function initChart() {

        data = new google.visualization.DataTable();
        data.addColumn('string', 'Name');
        data.addColumn('string', 'Parent');
        data.addColumn('string', 'ToolTip');

        chart = new google.visualization.OrgChart(document.getElementById('table_div'));
        options = {
            size: 'small',
            allowHtml: true
        };

        loadData();
        setInterval('loadData()', 15000);
    }
</script>