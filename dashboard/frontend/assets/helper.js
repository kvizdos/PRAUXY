const makeReq = (type, url, data, success, failure) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    
    xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
        const resp = JSON.parse(this.responseText);
        if(resp.status == "complete") {
            success()
        } else {
            failure(resp);
        }
    }
    });
    
    xhr.open(type, url);
    xhr.setRequestHeader("content-type", "application/x-www-form-urlencoded");
    
    xhr.send(data);
}