const retrieveApps = () => {
    $.get("http://home.kentonvizdos.com/api/all", (resp) => {
        for(app of resp) {
            $("#appContainer").prepend(`
            <a href="http://${app.shortName}.home.kentonvizdos.com">
                <div class="app">
                    ${app.isImage ? '<img src="assets/apps/' + app.image + '">' : app.name}
                </div>
            </a>
            `)
        }
    })
}

window.onload = function() {
    retrieveApps();
}