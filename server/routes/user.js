const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../model/user');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-xyz'; 

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Please provide all required fields' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        
        // Check if user already exists in MongoDB
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save new user to MongoDB
        const newUser = new User({
            username,
            email: normalizedEmail,
            password: hashedPassword
        });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please provide email and password' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        // Find user in MongoDB
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Compare password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id, email: user.email, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );

        res.json({ message: 'Logged in successfully', token, user: { username: user.username, email: user.email } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Verify token / Get Profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        // Optionially fetch fresh data from DB
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ message: 'Access granted', user });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching profile' });
    }
});

module.exports = router;