const admin = require('../firebase/firebase'); // Firebase bucket
const moveImageToMain = async (firebaseTempPath) => {
      const bucket=admin.storage().bucket();
    const fileName = firebaseTempPath.split('/').pop();
    const tempFile = bucket.file(firebaseTempPath);
    const mainFile = bucket.file(`main/${fileName}`);

    // Copy from temp to main
    await tempFile.copy(mainFile);

    // Delete from temp
    await tempFile.delete();

    // Generate public URL
    const mainUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(`main/${fileName}`)}?alt=media`;
    return mainUrl;
};

module.exports = { moveImageToMain };
