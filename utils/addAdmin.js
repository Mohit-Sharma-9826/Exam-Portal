const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const AdminProfile = require('../models/AdminProfile');
const readline = require("readline");

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer));
    });
}

async function getEmployeeDetails() {
    try{
        await connectDB();
        console.log("Enter details of the admin.");
        
        const employee = {
            name: await ask("Enter Name: "),
            email: await ask("Enter Email: "),
            password: await ask("Enter Password: "),
            empId: await ask("Enter Employee ID: "),
            department: await ask("Enter Department: ")
        };
        
        rl.close();
        
        const adminUser = await User.create({
            name: employee.name,
            email: employee.email,
            password: employee.password, // Will be hashed by pre-save hook
            role: 'admin'
        });
        
        await AdminProfile.create({
            user: adminUser._id,
            employeeId: employee.empId,
            department: employee.department
        });
        
        console.log("Admin created successfully.");
    }
    catch (err) {
        console.error(err);
    }
    finally {
        await mongoose.connection.close();
    }

}

getEmployeeDetails();

