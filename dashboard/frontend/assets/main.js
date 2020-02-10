const baseURL = "home.kentonvizdos.com";
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
    const isAdmin = getCookieValue("kvToken").split(":")[2] > 1;

    ModalHandler.setHeader(currentApp.name)
    ModalHandler.setContent(`
        <style>
        .thisModalContentTho p {
            font-size: 16pt;
        }

        .thisModalContentTho input {
            font-size: 14pt;
            padding: 4px;
        }

        .thisModalContentTho .small {
            font-size: 12pt;
        }
        </style>
        <article class="thisModalContentTho">
        <p>Group Level</p>
        <input ${!isAdmin ? "disabled" : ""} type="number" max="10" min="0" name="grouplvl" id="changeGroupLevel" placeholder="${currentApp.group}" value="${currentApp.group}" auto-complete="off" required>
        <br>        <br>
        <p>Whitelisted Users</p>
        <p class="small">COMMA SEPARATED NAMES! Used if a certain user below the required group level needs limited access without giving all of the permissions</p>
        <input ${!isAdmin ? "disabled" : ""} type="text" name="changeUsers" id="changeUsers" placeholder="${currentApp.users.join(",") || 'user1, user2'}" value="${currentApp.users.join(",")}" auto-complete="off" required>
        <br>
        <br>

        ${isAdmin ? `
        <input type="submit" value="Save" onclick="saveAppUpdates()">
        </article>
        <article class="thisModalContentTho" id="modalRegisterComplete">
            <p id="modalRegisterStatus"></p>
        </article>
        ` : ''}
    `)

    ModalHandler.open();
}

const newUserModal = (app) => {
    ModalHandler.setHeader("Register a user")
    ModalHandler.setContent(`
        <style>
        .thisModalContentTho p {
            font-size: 16pt;
        }

        .thisModalContentTho input {
            font-size: 14pt;
            padding: 4px;
        }
        </style>
        <article class="thisModalContentTho">
        <p>Username</p>
        <input type="text" name="name" id="registerUsername" placeholder="kvizdos" auto-complete="off" required>
        <br>
        <p>Email</p>
        <input type="email" name="name" id="registerEmail" placeholder="example@provider.com" auto-complete="off" required>
        <br>
        <br>

        <input type="submit" value="Add" onclick="register()">
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


const renderUsers = (users) => {
    activeUser = getCookieValue("kvToken").split(":")[1];
    
    $('.usernameText').text(activeUser);
    $('tbody#users').empty();

    for(const {username, lastLogin, email} of users) {
        if(username == activeUser) {
            $("#changeEmail")[0].value = email;
            $("#changeEmail")[0].placeholder = email;
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
}