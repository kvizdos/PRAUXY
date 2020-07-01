module.exports = {
    'url': `mongodb://${process.env.MONGO || "127.0.0.1"}:27017${process.env.NODE_ENV == 'test' ? '/prauxy-test' : ''}`
}

// const mongo = require("mongodb").MongoClient;
// const { MongoMemoryServer } = require('mongodb-memory-server');

// class mongodbHelper {
//     /**
//      * This is a helper for mongodb that simplifies repeated actions.
//      * 
//      * @constructor
//      */
//     constructor() {
//         if(process.env.NODE_ENV != "test") {
//             const url = "mongodb://localhost:27017/";
//             mongo.connect(url).then(client => {
//                 const db = client.db("prauxygo");
//                 this.db = db;
//             })
//         } else {
//             this.server = new MongoMemoryServer();
//         }
//     }

//     /**
//      * Creates a testing environment using MongodbMemoryServer
//      * 
//      * @async
//      * @returns {void}
//      */
//     async setupTestEnvironment() {
//         const url = await this.server.getConnectionString();
//         const client = await mongo.connect(await url);
//         this.db = client.db(await this.server.getDbName());    
//     }

//     /**
//      * Finds a query in a collection with an optional projection 
//      * 
//      * @async
//      * @param {string} collection - Where do you want to find the query
//      * @param {Object} query - What you are looking for
//      * @param {Object=} projection - Limits items returned to certain allow/block lists.
//      * @returns {Object[]} - List of all objects found 
//      */
//     async find(collection, query, projection = { '_id': 0 }) {
//         return new Promise((resolve, reject) => {
//             this.db.collection(collection).find(query).project(projection).toArray((err, res) => {
//                 if(err) reject(error);
//                 resolve(res);
//             })
//         });
//     }

//     /**
//      * Inserts an object into a collection
//      * 
//      * @async
//      * @param {string} collection - Where do you want to insert the item
//      * @param {Object} item - What do you want to insert
//      * @returns {Object[]} - Lists status of insertion
//      */
//     async insert(collection, item) {
//         return new Promise((resolve, reject) => {
//             this.db.collection(collection).insertOne(item, (err, res) => {
//                 if(err) reject(error);
//                 resolve(res);
//             })
//         })
//     }

//     /**
//      * Updates a single entry in a collection
//      * 
//      * @async
//      * @param {string} collection - Where do you want to update the item
//      * @param {Object} oldItem - Queried object to change
//      * @param {Object} newItem - Specifies the updated object
//      * @returns {Object[]} - Lists status of update
//      */
//     async update(collection, oldItem, newItem) {
//         return new Promise((resolve, reject) => {
//             this.db.collection(collection).updateOne(oldItem, newItem, (err, res) => {
//                 if(err) reject(err);

//                 resolve(res);
//             })
//         })
//     }
// }

// module.exports.mongo = mongodbHelper;