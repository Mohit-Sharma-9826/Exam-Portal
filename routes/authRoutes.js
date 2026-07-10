const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Renders
router.get('/login', authController.getLogin);
router.get('/register', authController.getRegister);
router.get('/admin-login', authController.getAdminLogin);

// POST requests
router.post('/register', authController.registerStudent);
router.post('/login', authController.loginStudent);
router.post('/admin-login', authController.loginAdmin);

// Logout
router.get('/logout', authController.logout);

module.exports = router;
