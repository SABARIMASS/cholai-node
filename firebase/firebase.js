/// firebase.js
const admin = require('firebase-admin');

require("dotenv").config();
if (!process.env.APPLICATION_CREDENTIALS_JSON) {
  throw new Error("❌ Firebase credentials are missing in environment variables.");
}
// Parse JSON string into object
const serviceAccount = JSON.parse(process.env.APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'cholai.firebasestorage.app', // Make sure this is correct
});

module.exports = admin;

