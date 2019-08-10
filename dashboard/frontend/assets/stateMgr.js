class StateManager {

    pages = [
        {page: "Dashboard", path: "/dash", id: "appContainer"},
        {page: "Add an app", path: "/add", id: "addApp"}
    ]

    constructor() {
        console.log("SM Loaded")

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

        this.setPage(this.currentState.page)
    }

    setPage = (page, el) => {
        // if(page == this.currentState.page) return;

        const goTo = this.pages.filter(p => p.page == page)[0];

        this.currentState.page = goTo.page;
        this.currentState.path = goTo.path;

        $('.navActive').removeClass('navActive')
        $(el).addClass('navActive')

        $(".page").addClass('hidePage');
        $("#" + goTo.id).removeClass('hidePage')

        $("#pageTitle").text(page.toUpperCase())

        hideMenu();

        history.pushState(this.currentState, page, goTo.path)
        document.title = page;
    }

    setListeners = () => {
        window.addEventListener('popstate', (e) => {
            this.setPage(e.state.page)
        });
    }
    
}