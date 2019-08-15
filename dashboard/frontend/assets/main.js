const baseURL = "home.kentonvizdos.com";
const proto = "http://";

const retrieveApps = () => {
    $.get(`${proto}${baseURL}/api/all`, (resp) => {
        localStorage.setItem("applications", JSON.stringify(resp));
        console.log(resp);
        renderApps(resp);
    })
}

const renderApps = (apps, first = false) => {
    if(!first) $(".customApp").remove();

    for(app of apps) {
        $("#appContainer").prepend(`
        <a class="customApp" href="${app.customURL == "" || app.customURL == undefined ? proto + app.shortName + "." + baseURL : proto + app.customURL} ">
            <div class="app">
                ${app.isImage ? '<img src="assets/apps/' + app.image + '">' : app.name}
            </div>
        </a>
        `)
    }
}

let _SM;

window.onload = function() {
    _SM = new StateManager();
    _SM.setListeners()
    if(localStorage.getItem("applications") != null) renderApps(JSON.parse(localStorage.getItem("applications")), true)
    retrieveApps();
}