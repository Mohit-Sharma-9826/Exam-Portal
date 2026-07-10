const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const studentController = require('../controllers/studentController');
const adminController = require('../controllers/adminController');
const examController = require('../controllers/examController');
const { protect, authorizeStudent, authorizeAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }

    cb(null, true);
  }
});


// STUDENT API ENDPOINTS
router.post('/student/save-answer', protect, authorizeStudent, studentController.saveAnswer);

// ADMIN API ENDPOINTS
router.post('/admin/students/:id/toggle', protect, authorizeAdmin, adminController.toggleStudentStatus);
router.post('/admin/questions/import', protect, authorizeAdmin, upload.single('csvFile'), examController.uploadQuestionsCSV);

module.exports = router;
