const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { protect, authorizeSuperAdmin } = require('../middleware/auth');

// Apply protection & superAdmin role
router.use(protect);
router.use(authorizeSuperAdmin);

// Admin Management
router.get('/admins', superAdminController.getAdmins);
router.post('/admins', superAdminController.createAdmin);
router.post('/admins/:id', superAdminController.updateAdmin);
router.delete('/admins/:id', superAdminController.deleteAdmin);
router.post('/admins/:id/reset-password', superAdminController.resetPassword);

module.exports = router;
