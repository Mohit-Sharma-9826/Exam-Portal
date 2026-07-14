const mongoose = require('mongoose');

const StudentProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Please provide a roll number'],
    unique: true,
    trim: true
  },
  batch: {
    type: String,
    required: [true, 'Please provide a batch'],
    trim: true
  },
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify an assigned administrator']
  },
  assignedExams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  }]
});

module.exports = mongoose.model('StudentProfile', StudentProfileSchema);
