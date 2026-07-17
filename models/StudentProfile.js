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

// Compound unique index so roll numbers are unique only within a single administrator's roster
StudentProfileSchema.index({ rollNumber: 1, assignedAdmin: 1 }, { unique: true });

module.exports = mongoose.model('StudentProfile', StudentProfileSchema);
