const socket = io({
    'reconnection': true,
});

const checkTFA = (num) => {
    socket.emit('checkTFA', getCookieValue("kvToken").split(":")[1], num, (success) => {
        console.log("here");
        if(success) {
            ModalHandler.close();
        } else {
            alert("Incorrect.");
        }
    })
}

socket.emit("connection", getCookieValue("kvToken").split(":")[1], (num1, num2, num3) => {
    if(num1 && num2 && num3) {
        confTFA(num1, num2, num3);
    }
})

socket.on('alert', (data) => {
    const msg = data.msg;
    const time = data.time;
    const type = data.type;

    showAlert(msg, time, type == "user" ? 'far fa-user' : undefined);
})

socket.on('confirmTfaNum', (num1, num2, num3) => {
    confTFA(num1, num2, num3);
})

const confTFA = (num1, num2, num3) => {
    ModalHandler.setHeader("Confirm the TFA number you see on the new device");
    ModalHandler.setContent(`
        <style>
            #tfaConfirm {
                display: flex;
                justify-content: center;
            }

            #tfaConfirm p {
                padding: 10px;
                margin: 10px;
                border-radius: 100%;
                border: 2px solid rgb(63, 106, 224);
                cursor: pointer;
                transition: .2s;
            }

            #tfaConfirm p:hover {
                background-color: rgb(63, 106, 224);
                color: white;
                transition: .2s;
            }

        </style>
        <article id="tfaConfirm">
            <p id="tfaNum1" onclick="checkTFA(13)">13</p>
            <p id="tfaNum2" onclick="checkTFA(13)">14</p>
            <p id="tfaNum3" onclick="checkTFA(13)">15</p>
        </article>
    `);

    document.getElementById("tfaNum1").innerText = num1;
    document.getElementById("tfaNum2").innerText = num2;
    document.getElementById("tfaNum3").innerText = num3;

    document.getElementById("tfaNum1").onclick = () => checkTFA(num1)
    document.getElementById("tfaNum2").onclick = () => checkTFA(num2)
    document.getElementById("tfaNum3").onclick = () => checkTFA(num3)

    ModalHandler.open();
}