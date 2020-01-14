const baseURL = "home.kentonvizdos.com";
const proto = window.location.protocol + "//";

const ModalHandler = new Modal('modalContainer')

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
        <div class="customApp">
            <div class="app">
                <a href="${app.customURL == "" || app.customURL == undefined ? proto + app.shortName + "." + baseURL : proto + app.customURL}" target="_blank">${app.isImage ? '<img src="assets/apps/' + app.image + '">' : `<span>${app.name}</span>`}</a>
            </div>
                            
            <div class="appSettings">
                <i class="material-icons" onclick="openSettingsModal('${app.shortName}')">settings_applications</i>
            </div>
        </div>
        `)
    }
}

const openSettingsModal = (app) => {
    const currentApp = JSON.parse(localStorage.getItem("applications")).filter(i => i.shortName == app)[0];

    ModalHandler.setHeader(currentApp.name)

    ModalHandler.open();
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

const toggleMenu = (el) => {
    if($(el).text() == "menu") {
        $(el).text('menu_open')
        $('#content').removeClass('hideHeaderMenu');
        $('#navbar').removeClass('hidden')
    } else {
        $(el).text('menu')
        $('#content').addClass('hideHeaderMenu');
        $('#navbar').addClass('hidden')
    }
}

let _SM;

window.onload = function() {
    _SM = new StateManager();
    _SM.setListeners()
    if(localStorage.getItem("applications") != null) renderApps(JSON.parse(localStorage.getItem("applications")), true)
    getAndCache(`${proto}${baseURL}/api/all`, "applications", renderApps);
    getAndCache(`${proto}${baseURL}/api/users/all`, "users", renderUsers);
    
    $('.usernameText').text(JSON.parse(localStorage.getItem("users"))[0]['username']);
}