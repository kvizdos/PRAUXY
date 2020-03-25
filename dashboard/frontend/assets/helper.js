const makeReq = (type, url, data, success, failure, contentType = "application/x-www-form-urlencoded") => {
    const xhr = new XMLHttpRequest();
    
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
    xhr.setRequestHeader("content-type", contentType);
    
    xhr.send(data);
}