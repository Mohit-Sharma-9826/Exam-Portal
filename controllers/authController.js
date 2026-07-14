const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const AdminProfile = require('../models/AdminProfile');
const jwt = require('jsonwebtoken');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026', {
    expiresIn: '30d'
  });
};

// Helper to set cookie
const sendTokenCookie = (user, statusCode, res, redirectUrl) => {
  const token = generateToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('token', token, cookieOptions);

  if (req_is_api(res.req)) {
    return res.status(statusCode).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  }

  res.redirect(redirectUrl);
};

// Helper to check if request expects API response
const req_is_api = (req) => {
  return req.originalUrl.startsWith('/api/');
};

// Helper to redirect authenticated users to their correct dashboards based on role
const redirectDashboard = async (token, res) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026');
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      if (user.role === 'admin' || user.role === 'superAdmin') {
        res.redirect('/admin/dashboard');
        return true;
      } else if (user.role === 'student') {
        res.redirect('/student/dashboard');
        return true;
      }
    }
    res.clearCookie('token');
    return false;
  } catch (err) {
    res.clearCookie('token');
    return false;
  }
};

// @desc    Render Student Login
exports.getLogin = async (req, res) => {
  if (req.cookies && req.cookies.token) {
    const redirected = await redirectDashboard(req.cookies.token, res);
    if (redirected) return;
  }
  res.render('auth/student-login', { error: req.query.error || null, success: req.query.success || null });
};

// @desc    Render Student Registration
exports.getRegister = async (req, res, next) => {
  if (req.cookies && req.cookies.token) {
    const redirected = await redirectDashboard(req.cookies.token, res);
    if (redirected) return;
  }
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('name email');
    res.render('auth/student-register', { error: req.query.error || null, admins });
  } catch (error) {
    next(error);
  }
};

// @desc    Render Admin Login
exports.getAdminLogin = async (req, res) => {
  if (req.cookies && req.cookies.token) {
    const redirected = await redirectDashboard(req.cookies.token, res);
    if (redirected) return;
  }
  res.render('auth/admin-login', { error: req.query.error || null });
};

// @desc    Register Student
exports.registerStudent = async (req, res, next) => {
  const { name, email, password, rollNumber, batch, adminId } = req.body;

  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('name email');

    // Check if user exists
    let userExists = await User.findOne({ email });
    if (userExists) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Email already registered' });
      return res.render('auth/student-register', { error: 'Email already registered', admins });
    }

    // Check if roll number exists
    let rollExists = await StudentProfile.findOne({ rollNumber });
    if (rollExists) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Roll number already exists' });
      return res.render('auth/student-register', { error: 'Roll number already exists', admins });
    }

    // Verify adminId is provided and active
    if (!adminId) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Please select an administrator' });
      return res.render('auth/student-register', { error: 'Please select an administrator', admins });
    }
    const adminExists = await User.findOne({ _id: adminId, role: 'admin', isActive: true });
    if (!adminExists) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Invalid administrator selected' });
      return res.render('auth/student-register', { error: 'Invalid administrator selected', admins });
    }

    // Create base user
    const user = await User.create({
      name,
      email,
      password,
      role: 'student'
    });

    // Create student profile
    await StudentProfile.create({
      user: user._id,
      rollNumber,
      batch,
      assignedAdmin: adminId
    });

    sendTokenCookie(user, 201, res, '/student/dashboard');
  } catch (error) {
    next(error);
  }
};

// @desc    Login Student
exports.loginStudent = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Check fields
    if (!email || !password) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Please provide email and password' });
      return res.render('auth/student-login', { error: 'Please provide email and password', success: null });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'student') {
      if (req_is_api(req)) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.render('auth/student-login', { error: 'Invalid credentials', success: null });
    }

    // Verify status
    if (!user.isActive) {
      if (req_is_api(req)) return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact administrator.' });
      return res.render('auth/student-login', { error: 'Your account is deactivated. Please contact administrator.', success: null });
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      if (req_is_api(req)) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.render('auth/student-login', { error: 'Invalid credentials', success: null });
    }

    sendTokenCookie(user, 200, res, '/student/dashboard');
  } catch (error) {
    next(error);
  }
};

// @desc    Login Admin
exports.loginAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Check fields
    if (!email || !password) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Please provide email and password' });
      return res.render('auth/admin-login', { error: 'Please provide email and password' });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user || (user.role !== 'admin' && user.role !== 'superAdmin')) {
      if (req_is_api(req)) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.render('auth/admin-login', { error: 'Invalid credentials' });
    }

    // Match password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      if (req_is_api(req)) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.render('auth/admin-login', { error: 'Invalid credentials' });
    }

    sendTokenCookie(user, 200, res, '/admin/dashboard');
  } catch (error) {
    next(error);
  }
};

// @desc    Logout User
exports.logout = (req, res) => {
  res.clearCookie('token');
  if (req_is_api(res.req)) {
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  }
  res.redirect('/auth/login?success=logged_out');
};
