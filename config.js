const config = function() {
    this.ports = {
        dashboard: process.env.DASHPORT || 8081,
        auth: process.env.AUTHPORT || 8082,
        unauthed: process.env.DEAUTHPORT || 8083,
        pageNotFound: process.env.PAGENOTFOUND || 8084,
        siteLauncher: process.env.SITELAUNCHER || 8085,
        siteLauncherHost: process.env.SITELAUNCHER || 8086,
        proxy: process.env.PORT || 81
    },
    this.email = {
        sgkey: process.env.SGKEY || "insert-key-here"
    },
    this.baseURL = process.env.URL || "home.kentonvizdos.com",
    this.protocol = "http",
    this.createURL = (app = "", noProto = false) => {
        return `${!noProto ? this.protocol + "://" : ""}${app != "" ? app + "." : ""}${this.baseURL}`
    },
    this.monitorLength = 600000 // 5 minutes in ms
}

module.exports = new config();