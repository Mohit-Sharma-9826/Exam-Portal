const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please provide question text'],
    trim: true
  },
  options: {
    A: { type: String, required: [true, 'Option A is required'], trim: true },
    B: { type: String, required: [true, 'Option B is required'], trim: true },
    C: { type: String, required: [true, 'Option C is required'], trim: true },
    D: { type: String, required: [true, 'Option D is required'], trim: true }
  },
  correctAnswer: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: [true, 'Please specify the correct option (A, B, C, or D)']
  },
  marks: {
    type: Number,
    required: [true, 'Please specify marks for this question'],
    default: 1,
    min: [1, 'Marks must be at least 1']
  },
  negativeMarks: {
    type: Number,
    required: [true, 'Please specify negative marks'],
    default: 0,
    min: [0, 'Negative marks cannot be negative']
  },
  subject: {
    type: String,
    required: [true, 'Please specify subject or category'],
    trim: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('Question', QuestionSchema);
