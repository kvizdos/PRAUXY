const authenticate = (token) => {
    return new Promise((resolve, reject) => {
        if(token !== undefined) {
            resolve(true);
        }

        resolve(false);
    })
}

module.exports = authenticate;