const mongoose = require('mongoose');

const StudentResponseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: true
  },
  responses: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    selectedOption: {
      type: String,
      enum: ['', 'A', 'B', 'C', 'D'],
      default: ''
    },
    markedForReview: {
      type: Boolean,
      default: false
    },
    visited: {
      type: Boolean,
      default: false
    }
  }],
  isSubmitted: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date
  }
});

// Compound index to ensure a student only has one active session per exam
StudentResponseSchema.index({ student: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model('StudentResponse', StudentResponseSchema);
