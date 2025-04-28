const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;  

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    // Get token from the 'Authorization' header, expecting "Bearer <token>"
    const token = req.headers['authorization']?.split(' ')[1];  // Assuming 'Bearer <token>'

    if (!token) {
        return res.status(401).json({ status: -1, message: 'Access denied, no token provided' });
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ status: -1, message: 'Invalid or expired token' });
        }
        req.user = user;  // Attach the decoded user data to the request object
        next();  // Proceed to the next middleware or route handler
    });
};

module.exports = authenticateToken;
