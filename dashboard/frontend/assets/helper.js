const makeReq = (type, url, data, success, failure) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    
    xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
        console.log(this)
        const resp = JSON.parse(this.responseText);
        if(this.status == 200) {
            success(resp)
        } else {
            failure(resp);
        }
    }
    });
    
    xhr.open(type, url);
    xhr.setRequestHeader("content-type", "application/x-www-form-urlencoded");
    
    xhr.send(data);
}