const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const AdminProfile = require('../models/AdminProfile');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/mailer');

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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // Create registration token containing registration details, expires in 5 minutes
    const regToken = jwt.sign(
      { name, email, password, rollNumber, batch, adminId },
      process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026',
      { expiresIn: '5m' }
    );

    // Set registration data cookie
    res.cookie('regToken', regToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 5 * 60 * 1000 // 5 minutes
    });

    // Upsert the OTP document (no registration details stored in DB!)
    await Otp.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        otp,
        expiresAt,
        lastSentAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Send OTP Email
    await sendOtpEmail(email, otp, name);

    if (req_is_api(req)) {
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully to your email. Please verify.',
        redirectUrl: `/auth/verify-otp?email=${encodeURIComponent(email)}`,
        regToken
      });
    }
    res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
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

    // Verify approval status
    if (!user.isApproved) {
      if (req_is_api(req)) return res.status(403).json({ success: false, message: 'Your account is pending approval by your administrator.' });
      return res.render('auth/student-login', { error: 'Your account is pending approval by your administrator.', success: null });
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

// @desc    Render OTP Verification Screen
exports.getVerifyOtp = async (req, res, next) => {
  const { email } = req.query;
  if (!email) {
    return res.redirect('/auth/register?error=Email%20is%20required');
  }
  res.render('auth/verify-otp', {
    email,
    error: req.query.error || null,
    success: req.query.success === 'otp_resent' ? 'A new OTP has been sent to your email.' : null
  });
};

// @desc    Verify OTP and Complete Registration
exports.verifyOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Email and OTP are required' });
      return res.render('auth/verify-otp', { email, error: 'Email and OTP are required', success: null });
    }

    let otpDoc = await Otp.findOne({ email: email.toLowerCase().trim() });

    // Active Expiration check: if it is expired in database, delete it immediately and treat as invalid
    if (otpDoc && new Date() > otpDoc.expiresAt) {
      await Otp.deleteOne({ _id: otpDoc._id });
      otpDoc = null;
    }

    if (!otpDoc) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Invalid or expired OTP session. Please register again.' });
      return res.render('auth/verify-otp', { email, error: 'Invalid or expired OTP session. Please register again.', success: null });
    }

    // Verify OTP code
    if (otpDoc.otp !== otp) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Invalid OTP code' });
      return res.render('auth/verify-otp', { email, error: 'Invalid OTP code', success: null });
    }

    // Read and verify registration token (regToken) from cookies or request body
    const token = req.cookies.regToken || req.body.regToken;
    if (!token) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Registration session expired. Please register again.' });
      return res.render('auth/verify-otp', { email, error: 'Registration session expired. Please register again.', success: null });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026');
    } catch (err) {
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Registration session expired. Please register again.' });
      return res.render('auth/verify-otp', { email, error: 'Registration session expired. Please register again.', success: null });
    }

    const { name, password, rollNumber, batch, adminId } = decoded;

    // Double check user doesn't already exist (just in case they registered while verifying)
    let userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      await Otp.deleteOne({ _id: otpDoc._id }); // Delete OTP session
      res.clearCookie('regToken');
      if (req_is_api(req)) return res.status(400).json({ success: false, message: 'Email already registered' });
      return res.redirect('/auth/register?error=Email%20already%20registered');
    }

    // Create student user with isApproved: false
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: 'student',
      isApproved: false // Requires admin approval
    });

    // Create student profile
    await StudentProfile.create({
      user: user._id,
      rollNumber,
      batch,
      assignedAdmin: adminId
    });

    // Delete single-use OTP document
    await Otp.deleteOne({ _id: otpDoc._id });

    // Clear registration data cookie
    res.clearCookie('regToken');

    if (req_is_api(req)) {
      return res.status(201).json({ success: true, message: 'Registration successful. Waiting for admin approval.' });
    }
    res.redirect('/auth/login?success=pending_approval');
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP with Cooldown
exports.resendOtp = async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Parse regToken to verify registration session exists and get the student's name
    const token = req.cookies.regToken || req.body.regToken;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Registration session expired. Please register again.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_exam_portal_jwt_secret_key_2026');
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Registration session expired. Please register again.' });
    }

    const { name } = decoded;
    let otpDoc = await Otp.findOne({ email: email.toLowerCase().trim() });

    // Active Expiration check: if it is expired in database, delete it immediately
    if (otpDoc && new Date() > otpDoc.expiresAt) {
      await Otp.deleteOne({ _id: otpDoc._id });
      otpDoc = null;
    }

    if (otpDoc) {
      // Enforce 30-second cooldown
      const timePassed = (new Date() - otpDoc.lastSentAt) / 1000;
      if (timePassed < 30) {
        const waitTime = Math.ceil(30 - timePassed);
        return res.status(400).json({ success: false, message: `Please wait ${waitTime} seconds before requesting a new OTP.` });
      }
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    // Upsert the OTP document (no registration details stored in DB!)
    await Otp.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        otp,
        expiresAt,
        lastSentAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Send email
    await sendOtpEmail(email, otp, name);

    return res.status(200).json({ success: true, message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    next(error);
  }
};
