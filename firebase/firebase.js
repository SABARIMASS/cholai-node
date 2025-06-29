// firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // your Firebase private key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://cholai.firebasestorage.app', // update this
});

const bucket = admin.storage().bucket();
module.exports = bucket;
