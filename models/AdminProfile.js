const mongoose = require('mongoose');

const AdminProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    required: [true, 'Please provide an employee ID'],
    unique: true,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Please provide a department'],
    trim: true
  }
});

module.exports = mongoose.model('AdminProfile', AdminProfileSchema);
