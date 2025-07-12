const path = require('path');
const admin = require('../firebase/firebase'); // Firebase bucket
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');


const uploadTemp = async (req, res) => {
    try {
        const bucket=admin.storage().bucket();
        if (!req.file) {
            return res.status(400).json({ status: -1, message: 'No file uploaded' });
        }

        const localPath = req.file.path;
        const ext = path.extname(req.file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const firebasePath = `temp/${fileName}`;

        await bucket.upload(localPath, {
            destination: firebasePath,
            metadata: {
                contentType: req.file.mimetype,
                metadata: {
                    firebaseStorageDownloadTokens: uuidv4(), // public download token
                }
            }
        });

        // Generate download URL
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(firebasePath)}?alt=media`;

        // Delete local file after upload
        fs.unlinkSync(localPath);

        res.status(200).json({
            status: 1,
            message: 'File uploaded to Firebase temp folder successfully',
            tempPath: firebasePath,
            downloadUrl: url,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            status: -1,
            message: 'Something went wrong during upload',
            error: error.message,
        });
    }
};



module.exports = { uploadTemp };
