const User = require('../models/User');
const AdminProfile = require('../models/AdminProfile');

// @desc    Get all admins list
exports.getAdmins = async (req, res, next) => {
  try {
    const adminUsers = await User.find({ role: 'admin' }).sort({ createdAt: -1 });

    // Hydrate user list with profile fields
    const admins = await Promise.all(
      adminUsers.map(async (u) => {
        const profile = await AdminProfile.findOne({ user: u._id });
        return {
          user: u,
          profile: profile || { employeeId: 'N/A', department: 'N/A' }
        };
      })
    );

    res.render('superadmin/admins', {
      title: 'Admin Management',
      admins,
      error: req.query.error || null,
      success: req.query.success || null,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new Admin user
exports.createAdmin = async (req, res, next) => {
  const { name, email, password, phone, employeeId, department } = req.body;

  try {
    const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
    // Hydrate for potential error renders
    const adminsList = await Promise.all(
      admins.map(async (u) => {
        const profile = await AdminProfile.findOne({ user: u._id });
        return { user: u, profile: profile || { employeeId: 'N/A', department: 'N/A' } };
      })
    );

    // Validate email
    let userExists = await User.findOne({ email });
    if (userExists) {
      return res.render('superadmin/admins', {
        title: 'Admin Management',
        admins: adminsList,
        error: 'Email already in use',
        success: null,
        user: req.user
      });
    }

    // Validate employee ID uniqueness
    let employeeIdExists = await AdminProfile.findOne({ employeeId });
    if (employeeIdExists) {
      return res.render('superadmin/admins', {
        title: 'Admin Management',
        admins: adminsList,
        error: 'Employee ID already in use',
        success: null,
        user: req.user
      });
    }

    // Create Admin User
    const userObj = await User.create({
      name,
      email,
      password,
      phone,
      role: 'admin'
    });

    // Create Admin Profile with input values
    await AdminProfile.create({
      user: userObj._id,
      employeeId,
      department
    });

    res.redirect('/superadmin/admins?success=admin_created');
  } catch (error) {
    next(error);
  }
};

// @desc    Update Admin user details
exports.updateAdmin = async (req, res, next) => {
  const { name, email, phone, employeeId, department } = req.body;

  try {
    const adminUser = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!adminUser) {
      return res.redirect('/superadmin/admins?error=admin_not_found');
    }

    // Check unique email
    const emailExists = await User.findOne({ email, _id: { $ne: req.params.id } });
    if (emailExists) {
      return res.redirect('/superadmin/admins?error=email_exists');
    }

    // Check unique employeeId
    const profile = await AdminProfile.findOne({ user: req.params.id });
    if (profile) {
      if (employeeId !== profile.employeeId) {
        const empExists = await AdminProfile.findOne({ employeeId });
        if (empExists) {
          return res.redirect('/superadmin/admins?error=employee_id_exists');
        }
      }
      profile.employeeId = employeeId;
      profile.department = department;
      await profile.save();
    } else {
      // If profile somehow didn't exist, create it
      await AdminProfile.create({
        user: req.params.id,
        employeeId,
        department
      });
    }

    adminUser.name = name;
    adminUser.email = email;
    adminUser.phone = phone;
    await adminUser.save();

    res.redirect('/superadmin/admins?success=admin_updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Admin user
exports.deleteAdmin = async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Super Admins cannot delete their own account' });
    }

    const adminUser = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Delete base User and Admin Profile
    await User.deleteOne({ _id: req.params.id });
    await AdminProfile.deleteOne({ user: req.params.id });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Admin password
exports.resetPassword = async (req, res, next) => {
  const { newPassword } = req.body;

  try {
    const adminUser = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!adminUser) {
      return res.redirect('/superadmin/admins?error=admin_not_found');
    }

    if (!newPassword || newPassword.length < 6) {
      return res.redirect('/superadmin/admins?error=password_too_short');
    }

    adminUser.password = newPassword; // Will be hashed automatically by user model pre-save hook
    await adminUser.save();

    res.redirect('/superadmin/admins?success=password_reset');
  } catch (error) {
    next(error);
  }
};
