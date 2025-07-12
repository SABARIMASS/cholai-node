const admin = require('../firebase/firebase');

async function sendPushNotification({
    tokens,
    title,
    body,
    data = {},
}) {
    if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
        console.log("NO TOKEN AVAILABLE PUSH NOTIFY");
    }

    const tokenList = Array.isArray(tokens) ? tokens : [tokens];

    //   console.log("Sending to tokens:", tokenList);

    for (const token of tokenList) {
        const message = {
            notification: { title, body },
            data,
            token,
        };

        try {
            const response = await admin.messaging().send(message);
        } catch (err) {
            console.error(`Error for ${token}:`, err);
        }
    }
}
module.exports = { sendPushNotification };