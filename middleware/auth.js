const jwt = require('jsonwebtoken');
const User = require('../models/User');

// General Authentication Middleware
exports.protect = async (req, res, next) => {
  let token;

  // Retrieve token from cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    // If it's an API request, return JSON. Otherwise redirect to login.
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Not authorized, login required' });
    }
    return res.redirect('/auth/login');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026');

    // Attach user to request
    req.user = await User.findById(decoded.id);

    if (!req.user || !req.user.isActive) {
      res.clearCookie('token');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'User is inactive or deleted' });
      }
      return res.redirect('/auth/login?error=account_inactive');
    }

    // Pass role to views
    res.locals.user = req.user;
    next();
  } catch (err) {
    console.error(err);
    res.clearCookie('token');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
    return res.redirect('/auth/login');
  }
};

// Admin only middleware
exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
  }
  return res.redirect('/auth/admin-login?error=unauthorized');
};

// Student only middleware
exports.authorizeStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    return next();
  }

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(403).json({ success: false, message: 'Forbidden: Student access only' });
  }
  return res.redirect('/auth/login?error=unauthorized');
};
