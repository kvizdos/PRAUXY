const login = () => {
    const username = $("#username").val();
    const password = $("#password").val();

    $("#login").prop("disabled", true);

    $.post("http://auth." + window.location.hostname.split(".").splice(1).join(".") + "/login", {
        username: username,
        password: password
    }, (res) => {
        if(res.authenticated) {
            if(!res.showMFA) {
                $("#firstStep").hide();
                $("#secondStep").show();
            } else {
                $("#firstStep").hide();
                $('#mfaQR').attr('src', res.qr);
                $("#mfaStep").show();
            }
        } else {
            alert("Incorrect Username / Password");
        }
    })
}

const addedMFA = () => {
    $('#mfaStep').hide()
    $("#secondStep").show();
}

function setcookie(name, value, days)
{
  if (days)
  {
    var date = new Date();
    date.setTime(date.getTime()+days*24*60*60*1000); // ) removed
    var expires = "; expires=" + date.toGMTString(); // + added
  }
  else
    var expires = "";
  document.cookie = name+"=" + value+expires + ";path=/;domain=home.kentonvizdos.com"; // + and " added
}

const confirmMFA = () => {
    const mfa = $("#mfa").val();
    const username = $("#username").val();

    $.post("http://auth." + window.location.hostname.split(".").splice(1).join(".") + "/login/mfa", {
        username: username,
        mfa: mfa
    }, (res) => {
        if(res.authenticated) {
            setcookie("kvToken", res.token + ":" + username, 365);
            var url = new URL(window.location.href);
            var redir = url.searchParams.get("go");

            window.location.href = "http://" + (redir !== null ? redir + "." : "") + "home.kentonvizdos.com";
        } else {
            alert("Incorrect 2FA code");
        }
    })
}