const uploadTemp = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: -1, message: 'No file uploaded' });
        }

        const tempPath = req.file.path; // Now includes the correct filename with extension
        res.status(200).json({
            status: 1,
            message: 'File uploaded successfully',
            tempPath: tempPath,
            fileName: req.file.filename, // Provide the filename for additional clarity
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            status: -1,
            message: 'Something went wrong while uploading the file',
            error: error.message,
        });
    }
};

module.exports = { uploadTemp };
