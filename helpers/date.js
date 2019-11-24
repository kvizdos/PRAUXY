module.exports.pretty = () => {
    var dateIn = new Date();
    var yyyy = dateIn.getFullYear();
    var mm = dateIn.getMonth() + 1; // getMonth() is zero-based
    var dd = dateIn.getDate();
    return String(yyyy + "/" + mm + "/" + dd); 
}