const baseURL = window.location.href.split("/")[2]
const proto = window.location.protocol + "//";

const ModalHandler = new Modal('modalContainer')

const getCookieValue = (a) => {
    var b = document.cookie.match('(^|[^;]+)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : '';
}

const getAndCache = (url, lsItem, cb = () => {}) => {
    $.get(url, (resp) => {
        localStorage.setItem(lsItem, JSON.stringify(resp));
        cb(resp);
    })
}

let activeUser = "";

const renderApps = (apps, first = false) => {
    if(!first) $(".customApp").not('.full').remove();

    for(app of apps) {
        $(`
        <div class="customApp">
            <div class="app">
                <a href="${app.customURL == "" || app.customURL == undefined ? proto + app.shortName + "." + baseURL : proto + app.customURL}" target="_blank">${app.isImage ? '<img src="assets/apps/' + app.image + '">' : `<span>${app.name}</span>`}</a>
            </div>
            <div class="appSettings">
                <i class="material-icons" onclick="openSettingsModal('${app.shortName}')">settings_applications</i>
            </div>
        </div>
        `).insertBefore('#addAppBtn')
    }
}

const openSettingsModal = (app) => {
    const currentApp = JSON.parse(localStorage.getItem("applications")).filter(i => i.shortName == app)[0];
    const isAdmin = getCookieValue("prauxyToken").split(":")[2] > 1;

    ModalHandler.setHeader(currentApp.name)
    ModalHandler.setContent(`
        <article class="thisModalContentTho">
        <article class="formItem">
            <label>Group Level</label>
            <input ${!isAdmin ? "disabled" : ""} type="number" max="10" min="0" name="grouplvl" id="changeGroupLevel" placeholder="${currentApp.group}" value="${currentApp.group}" auto-complete="off" required>
        </article>

        <article class="formItem">
            <label>Whitelisted Users</label>
            <p class="small">COMMA SEPARATED NAMES! Used if a certain user below the required group level needs limited access without giving all of the permissions</p>
            <br>
            <input ${!isAdmin ? "disabled" : ""} type="text" name="changeUsers" id="changeUsers" placeholder="${currentApp.users.join(",") || 'user1, user2'}" value="${currentApp.users.join(",")}" auto-complete="off" required>
        </article>
        <article class="formItem">
        ${isAdmin ? `
        <input type="submit" value="Save" onclick="saveAppUpdates()">
        </article>
        <article class="thisModalContentTho" id="modalRegisterComplete">
            <p id="modalRegisterStatus"></p>
        </article>
        ` : ''}
        </article>
    `)

    ModalHandler.open();
}

const newUserModal = (app) => {
    ModalHandler.setHeader("Register a user")
    ModalHandler.setContent(`
        <article class="thisModalContentTho">
        <article class="formItem">
            <label>Username</label>
            <input type="text" name="name" id="registerUsername" placeholder="kvizdos" auto-complete="off" required>
        </article>
        <article class="formItem">
            <label>Email</label>
            <input type="email" name="name" id="registerEmail" placeholder="example@provider.com" auto-complete="off" required>
        </article>

        <article class="formItem">
            <input type="submit" value="Add" onclick="register()">
        </article>
        </article>
        <article class="thisModalContentTho" id="modalRegisterComplete">
            <p id="modalRegisterStatus"></p>
        </article>
    `)

    ModalHandler.open();
}

const addAppModal = () => {
    ModalHandler.setHeader("Add an App")
    ModalHandler.setContent(`
    <form id="createNewApplication" enctype="multipart/form-data" action="/api/new" method="post">
        <article class="formItem">        
            <label>Application Name</label>
            <input type="text" name="name" id="name" placeholder="Visual Studio Code" required>
        </article>
        <article class="formItem">
            <label>Application Short Name</label>
            <input type="text" name="short" id="short" placeholder="code" required>
        </article>
        <article class="formItem">
            <label>Application Address (either just a port or IP:PORT)</label>
            <input type="text" name="port" id="port" placeholder="8080/an_optional_path or 127.0.0.1:8080" required>
        </article>
        <article class="formItem">
            <label>GitHub Repo URL</label>
            <input type="text" name="github" id="github" placeholder="https://github.com/kvizdos/PRAUXY" required>
        </article>
        <article class="formItem">
            <label class="optional">App Icon</label>
            <input name="icon" id="icon" type="file" accept="image/*">
        </article>

        <article class="formItem">
            <label class="optional">Custom URL</label>
            <input name="customurl" type="text" id="customURL" placeholder="default is: {{subdomain}}.{{base_url}}">
        </article>
        
        <article class="formItem checkbox">    
            <input checked name="ra" type="checkbox" id="requireAuthentication">
            <label>Require Authentication</label>
        </article>

        <article class="formItem">
            <input type="submit" value="Add">
        </article>
    </form>
    `)

    ModalHandler.open();
}

const newSiteModal = () => {
    ModalHandler.setHeader("Create a new site")
    ModalHandler.setContent(`
        <article class="thisModalContentTho">
            <article class="formItem">
                <label>Name</label>
                <input type="text" name="name" id="newSiteName" placeholder="Portfolio" auto-complete="off" required>
            </article>
            <article class="formItem">
                <label>Short Name</label>
                <input type="text" name="name" id="newSiteShortName" placeholder="port" auto-complete="off" required>
            </article>
            <article class="formItem">
                <label>GitHub Repo URL (not SSH/HTTPS, just the normal URL)</label>
                <input type="text" name="name" id="newSiteRepo" placeholder="https://github.com/kvizdos/Portfolio" auto-complete="off" required>
            </article>
            <article class="formItem">
                <label class="optional">Root Directory</label>
                <input type="text" name="name" id="newSiteRoot" placeholder="portfolio" auto-complete="off">
            </article>
            <article class="formItem">
                <label class="optional">Custom URL</label>
                <input type="text" name="name" id="newSiteCustomURL" placeholder="kentonvizdos.com" auto-complete="off">
            </article>
            <article class="formItem">
                <input type="submit" id="createNewSiteBtn" value="Add" onclick="createNewSite()">
            </article>
        </article>
        <article class="thisModalContentTho" id="modalRegisterComplete">
            <p id="modalRegisterStatus"></p>
        </article>
    `)

    ModalHandler.open();
}

const saveAppUpdates = () => {
    const newGroupLevel = $("#changeGroupLevel")[0].value
    const newUsers = $("#changeUsers")[0].value

    makeReq("POST", `${proto}${baseURL}/api/update`, `name=${ModalHandler.header}&lvl=${newGroupLevel}&users=${newUsers || 'no-users-added'}`, () => { alert("Saved!"); ModalHandler.close() }, () => { alert("Something went wrong. Please reload.") })

}

const updateUser = (type, info = {}) => {
    switch(type) {
        case "reset password":
            const old = $('#oldPass')[0].value;
            const newp = $('#newPass')[0].value;
            const conf = $('#newPassConf')[0].value;
            if((newp == "" || newp == undefined) || newp != conf) {
                alert("Password confirmation failed. Please make sure they are both the same.");
                return;
            }

            if(old == "") {
                alert("You must also enter your current password.")
                return;
            }

            makeReq("POST", `${proto}auth.${baseURL}/users/update`, `type=resetpw&username=${activeUser}&old=${old}&newp=${newp}`, () => { alert("Password changed!") }, (err) => { alert("Failed to reset password. Please reload page. " + err.reason) });
            break;
        case "change email":
            const email = $('#changeEmail')[0].value;

            if(email == "") {
                alert("The email cannot be blank!")
                return;
            }

            makeReq("POST", `${proto}auth.${baseURL}/users/update`, `type=changeemail&username=${activeUser}&email=${email}`, () => { alert("Email changed!") }, (err) => { alert("Failed to change email. Please reload page. " + err.reason) });
            break;
    }
}

const deleteUser = (user) => {
    modalConfirmation(`Are you sure you want to delete the user ${user}?`, () => {
        makeReq("POST", `${proto}auth.${baseURL}/users/update`, `type=delete&username=${user}`, () => {
            getAndCache(`${proto}auth.${baseURL}/users/all`, "users", renderUsers);
            alert("User deleted.");
        }, (err) => {
            alert("User failure: " + err.reason);
        })
    }, () => {});
}

const register = () => {
    const username = document.getElementById("registerUsername").value;
    const email = document.getElementById("registerEmail").value;
    const data = `username=${username}&email=${email}&group=0`;
    
    makeReq("POST", `${proto}auth.${baseURL}/users/register`, data, () => {
        getAndCache(`${proto}auth.${baseURL}/users/all`, "users", renderUsers);
        document.getElementById("modalRegisterStatus").innerText = "User added!";
    }, (err) => {
        alert("User failure: " + err.reason);
    })
}

const createNewSite = () => {
    const name = document.getElementById("newSiteName").value;
    const shortName = document.getElementById("newSiteShortName").value;
    const repo = document.getElementById("newSiteRepo").value;
    const rootDir = document.getElementById("newSiteRoot").value || "";
    const custom = document.getElementById("newSiteCustomURL").value || "";

    console.log(name, shortName, repo, rootDir, custom)

    document.getElementById("createNewSiteBtn").value = "Creating..."
    document.getElementById("createNewSiteBtn").disabled = true;
    
    let data = JSON.stringify({
        name: name,
        shortName: shortName,
        repo: repo,
        root: rootDir,
        customurl: custom
    })
    
    makeReq("POST", `${proto}sites.${baseURL}/api/create`, data, (data) => {
        console.log(data)
        getAndCache(`${proto}sites.${baseURL}/api/all`, "sites", renderSites);
        console.log()
        if(data.status == "complete") {
            document.getElementById("createNewSiteBtn").value = "Done!"
            document.getElementById("modalRegisterStatus").innerHTML = `
            <p>Site created!</p>
            <br>
            <strong>Make sure to set the GitHub Webhook for the repo you specified to ${proto}sites.${baseURL}/api/update and set the secret token to ${data.secret}!</strong>
            `;
        } else {
            document.getElementById("createNewSiteBtn").value = "Add"
            document.getElementById("createNewSiteBtn").disabled = false;
            document.getElementById("modalRegisterStatus").innerHTML = `
            <p>Site failed to publish.</p>
            <br>
            <strong>${data.reason}</strong>
            `;
        }
    }, (err) => {
        alert("User failure: " + err.reason);
    }, "application/json")
}


const renderUsers = (users) => {
    activeUser = getCookieValue("prauxyToken").split(":")[1];
    
    $('.usernameText').text(activeUser);
    $('tbody#users').empty();

    for(const {username, lastLogin, email, connections} of users) {
        if(username == activeUser) {
            $("#changeEmail")[0].value = email;
            $("#changeEmail")[0].placeholder = email;
            $(".connection#github").toggle(connections.github != undefined && connections.github == false);
            $(".connection.activated#github").toggle(connections.github != undefined && connections.github == true);
        }
        $('tbody#users').append(`
            <tr>
                <td>${username}</td>
                <td>${lastLogin != undefined ? (new Date(lastLogin)).toString() : "Never logged in"}</td>
                <td><button class="deleteUserBtn" onclick="deleteUser('${username}')">-</button></td>
            </tr>
        `)
    }
}

const renderSites = (sites) => {    
    $('tbody#sites').empty();

    for(const {name, pushSecret, root, customURL, shortName } of sites) {
        $('tbody#sites').append(`
            <tr>
                <td>${name}</td>
                <td>Static</td>
                <td>${pushSecret}</td>
                <td><a href="${customURL == undefined || customURL == "" ? `${proto}site-${shortName}.${baseURL}` : proto + customURL}" target="_blank">Vist</a></td>
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

const logout = () => {
    modalConfirmation("Are you sure you want to logout?", () => {
        localStorage.clear();
        sessionStorage.clear();

        var res = document.cookie;
        var multiple = res.split(";");
        for(var i = 0; i < multiple.length; i++) {
           var key = multiple[i].split("=");
           document.cookie = key[0]+` =;domain=.${baseURL};expires = Thu, 01 Jan 1970 00:00:00 UTC`;
        }

        window.location = "/";
    }, () => {});
}

const modalConfirmation = (message, success, cancel) => {
    const conf = confirm(message);
    console.log(conf)
    if(conf) success();
    if(!conf) cancel();
}

let _SM;

window.onload = function() {
    _SM = new StateManager();
    _SM.setListeners()
    if(localStorage.getItem("applications") != null) renderApps(JSON.parse(localStorage.getItem("applications")), true)
    getAndCache(`${proto}${baseURL}/api/all`, "applications", renderApps);
    getAndCache(`${proto}auth.${baseURL}/users/all`, "users", renderUsers);
    getAndCache(`${proto}sites.${baseURL}/api/all`, "sites", renderSites);

    // startCanvas();
}