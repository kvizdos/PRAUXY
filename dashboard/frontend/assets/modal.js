function Modal(container) {
    this.container = container;
    this.header = "Modal";
    this.content = "<span>Empty</span>";

    this.setHeader = (header) => {
        document.getElementById(this.container).children[0].children[0].innerText = header;
        this.header = header;
    }

    this.setContent = (content) => {
        document.getElementById(this.container).children[0].children[1].innerHTML = content;
        this.content = content;
    }
    
    this.open = () => {
        document.getElementById(this.container).style.display = "flex";
    }

    this.close = (ev) => {
        if(ev != null) {
            console.log(ev.target)
        }
        document.getElementById(this.container).style.display = "none";
    }
}