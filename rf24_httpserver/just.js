var chart;
var charts;
var data;

google.load("visualization", "1.1", {packages:["table"]});
google.setOnLoadCallback(initChart());

function loadData() {

    // variable for the data point
    var p;
    var channel_id = window.parent.location.pathname.match(/\d+/g);
    $.getJSON('https://api.thingspeak.com/channels/' + channel_id + '/feed/last.json', function(data) {

        // get the data point
        p = data.field3;
        if (p)
        {
            p = Math.round(p * 10) / 10;
            displayData(p);
        }
    });
}

function initChart() {

    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Name');
    data.addColumn('number', 'Salary');
    data.addColumn('boolean', 'Full Time Employee');
    data.addRows([
        ['Mike',  {v: 10000, f: '$10,000'}, true],
        ['Jim',   {v:8000,   f: '$8,000'},  false],
        ['Alice', {v: 12500, f: '$12,500'}, true],
        ['Bob',   {v: 7000,  f: '$7,000'},  true]
    ]);

    var table = new google.visualization.Table(document.getElementById('table_div'));

    table.draw(data, {showRowNumber: true, width: '100%', height: '100%'});

    loadData();

    setInterval('loadData()', 15000);
}




var table;
//var charts;
var data;

google.load('visualization', '1', {packages:['table']});
google.setOnLoadCallback(initChart);

function displayData(sensorData) {

    data.addRows(sensorData);
    table.draw(data, options);
}

function loadData() {

var sensorData = [];
    var channel_id = window.parent.location.pathname.match(/\d+/g);
    $.getJSON('https://api.thingspeak.com/channels/' + channel_id + '/feed.json?results=10', function(data) {
        for (var index = 0; index < data.feeds.length; ++index){
            var k = data.feeds[index];
            sensorData.push([Number(k.entry_id), new Date(k.created_at), Number(k.field3), Number(k.field1), k.field2 ]);
        };
       displayData(sensorData);
    });
}

function initChart() {

    data = new google.visualization.DataTable();
    data.addColumn('number','Update Id');
    data.addColumn('datetime', 'Update Time');
    data.addColumn('number', 'Temperature');
    data.addColumn('number', 'Node Id');
    data.addColumn('string', 'IP Address');


    table = new google.visualization.Gauge(document.getElementById('table_div'));
    options = {
        width: '100%', height: '100%',
        showRowNumber: true
    };

    loadData();

    setInterval('loadData()', 15000);
}
