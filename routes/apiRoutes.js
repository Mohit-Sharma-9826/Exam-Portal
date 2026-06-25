const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const studentController = require('../controllers/studentController');
const adminController = require('../controllers/adminController');
const examController = require('../controllers/examController');
const { protect, authorizeStudent, authorizeAdmin } = require('../middleware/auth');

// Configure Multer for temp CSV file uploads
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  }
});

// ==========================================
// STUDENT API ENDPOINTS
// ==========================================
router.post('/student/save-answer', protect, authorizeStudent, studentController.saveAnswer);

// ==========================================
// ADMIN API ENDPOINTS
// ==========================================
router.post('/admin/students/:id/toggle', protect, authorizeAdmin, adminController.toggleStudentStatus);
router.post('/admin/questions/import', protect, authorizeAdmin, upload.single('csvFile'), examController.uploadQuestionsCSV);

module.exports = router;
