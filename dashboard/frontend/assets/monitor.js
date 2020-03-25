    let chart;
    function toogleDataSeries(e){
        if (typeof(e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
            e.dataSeries.visible = false;
        } else{
            e.dataSeries.visible = true;
        }
        chart.render();
    }

    function startCanvas() {
        makeReq("GET", `${proto}${baseURL}/api/monitors?type=speedtest`, ``, (d) => {
            let uploadPoints = [];
            let downloadPoints = [];

            for(let dp of d) {
                console.log(dp)
                uploadPoints.push({x: new Date(dp.time), y: dp.uploadMbps})
                downloadPoints.push({x: new Date(dp.time), y: dp.download})

            }

            chart = new CanvasJS.Chart("chartContainer", {
                backgroundColor: "#f5f5f5",
                markerBorderThickness: 10,
                axisX: {
                    valueFormatString: "h:mm tt"
                },
                toolTip: {
                    shared: true
                },
                legend: {
                    cursor: "pointer",
                    verticalAlign: "top",
                    horizontalAlign: "center",
                    dockInsidePlotArea: true,
                    itemclick: toogleDataSeries
                },
                data: [{
                    type:"line",
                    axisYType: "secondary",
                    name: "Upload",
                    showInLegend: true,
                    markerSize: 0,
                    yValueFormatString: "## Mbps",
                    dataPoints: uploadPoints
                },
                {
                    type:"line",
                    axisYType: "secondary",
                    name: "Download",
                    showInLegend: true,
                    markerSize: 0,
                    yValueFormatString: "#### Mbps",
                    dataPoints: downloadPoints
                }]
            });
            chart.render();
        }, () => { console.error("Error loading monitor data") })
    }