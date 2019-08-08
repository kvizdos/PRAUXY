const config = function() {
    this.ports = {
        dashboard: 8081,
        auth: 8082,
        unauthed: 8083,
        proxy: 80
    },
    this.baseURL = "home.kentonvizdos.com",
    this.protocol = "http",
    this.createURL = (app = "", noProto = false) => {
        return `${!noProto ? this.protocol + "://" : ""}${app != "" ? app + "." : ""}${this.baseURL}`
    }
}

module.exports = new config();