const baseURL = "home.kentonvizdos.com";
const proto = window.location.protocol + "//";

const getAndCache = (url, lsItem, cb = () => {}) => {
    $.get(url, (resp) => {
        localStorage.setItem(lsItem, JSON.stringify(resp));
        cb(resp);
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

const renderUsers = (users) => {
    for(const {username, lastLogin} of users) {
        $('tbody#users').append(`
            <tr>
                <td>${username}</td>
                <td>${(new Date(lastLogin)).toString()}</td>
            </tr>
        `)
    }
}

let _SM;

window.onload = function() {
    _SM = new StateManager();
    _SM.setListeners()
    if(localStorage.getItem("applications") != null) renderApps(JSON.parse(localStorage.getItem("applications")), true)
    getAndCache(`${proto}${baseURL}/api/all`, "applications", renderApps);
    getAndCache(`${proto}${baseURL}/api/users/all`, "users", renderUsers);
}