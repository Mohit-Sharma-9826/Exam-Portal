const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Renders
router.get('/login', authController.getLogin);
router.get('/register', authController.getRegister);
router.get('/admin-login', authController.getAdminLogin);
router.get('/verify-otp', authController.getVerifyOtp);

// POST requests
router.post('/register', authController.registerStudent);
router.post('/login', authController.loginStudent);
router.post('/admin-login', authController.loginAdmin);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);

// Logout
router.get('/logout', authController.logout);

module.exports = router;
