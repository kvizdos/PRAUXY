const socket = io();

socket.emit("connection", getCookieValue("kvToken").split(":")[1])

socket.on('alert', (data) => {
    const msg = data.msg;
    const time = data.time;
    const type = data.type;

    showAlert(msg, time, type == "user" ? 'far fa-user' : undefined);
})