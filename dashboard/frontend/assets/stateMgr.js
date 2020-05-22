class StateManager {
    constructor() {
        this.pages = [
            {page: "Dashboard", path: "/dash", id: "appContainer", group: 0},
            {page: "Users", path: "/users", id: "userList", group: 1},
            {page: "Add User", path: "/users/add", id: "addUser", group: 1},
            {page: "User Settings", path: "/me/settings", id: "userSettings", group: 0},
            {page: "Sites", path: "/sites", id: "siteLauncher", group: 1}
        ]

        this.username = getCookieValue("prauxyToken").split(":")[1];
        this.group    = getCookieValue("prauxyToken").split(":")[2];

        console.log(`SM Loaded (${this.username} - ${this.group})`)

        this.pages = this.pages.filter(p => {
            let c = $("#links").children()
            if(p.group > this.group) {
                for(var z of c) {
                    if(z.innerText == p.page) {
                        console.log("Deleting " + z.innerText)
                        z.remove();
                    }
                }

                $("#" + p.id).remove();
                return false;
            } else {
                return true;
            }
        });

        const goTo = this.pages.filter(p => p.path == window.location.pathname)[0];

        if(goTo !== undefined) {
            this.currentState = history.state || {
                page: goTo.page,
                path: goTo.path
            };
        } else {
            this.currentState = history.state || {
                page: "Dashboard",
                path: "/dash"
            }
        }

        this.setPage(this.currentState.page, this.getNavItem(this.currentState.page));
    }

    getNavItem(page) {
        return $("#links").children().toArray().find(el => el.innerText == page);
    }

    setPage(page, el) {
        // if(page == this.currentState.page) return;

        const goTo = this.pages.filter(p => p.page == page)[0];

        this.currentState.page = goTo.page;
        this.currentState.path = goTo.path;

        $('.navActive').removeClass('navActive')
        $(el).addClass('navActive')

        $(".page").addClass('hidePage');
        $("#" + goTo.id).removeClass('hidePage')

        $(".pageTitle").text(page.toUpperCase())

        hideMenu();

        history.pushState(this.currentState, page, goTo.path)
        document.title = page;
    }

    setListeners() {
        window.addEventListener('popstate', (e) => {
            this.setPage(e.state.page)
        });
    }
    
}