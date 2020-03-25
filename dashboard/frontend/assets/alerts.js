const showAlert = (msg, time, icon = "far fa-question-circle") => {
    const alertContainer = document.querySelector('.alerts');

    const uid = Math.floor(Math.random() * 10000) + 100;

    alertContainer.innerHTML = `
    <article class="alert uid-${uid}">
        <p class="icon"><i class="${icon}"></i></p>
        <section>
            <p class="message">${msg}</p>
            <p class="timestamp">${time}</p>
        </section>
    </article>
    ` + alertContainer.innerHTML;

    setTimeout(function() {

        document.querySelector('.alert.uid-' + uid).style.opacity = 1

        setTimeout(function() {
            document.querySelector('.alert.uid-' + uid).style.opacity = 0;
            setTimeout(function() {
                // document.querySelector('.alert.uid-' + uid).remove()
            }, 200)
        }, 3000)

    }, 100)

}