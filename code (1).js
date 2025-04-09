// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY'); // Use environment variables!
// ... import other necessary libraries ...

const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies

// MongoDB Connection (Replace with your connection string)
mongoose.connect('mongodb://localhost:27017/mjeyi_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema (Simplified - add all necessary fields)
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store hashed password!
    idNumber: { type: String },
    phoneNumber: { type: String },
    address: { type: String },
  // ... other fields ...
    bankName: { type: String },
    accountNumber: { type: String }, // VERY SENSITIVE - Encrypt!
    // ... other banking details ...
  // Store credit report data - probably as nested objects or separate collections
    creditReports: [{
        source: String, // e.g., 'TransUnion', 'XDS'
        reportData: mongoose.Schema.Types.Mixed, // Store the raw report data
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- API Endpoints ---

// Registration
app.post('/api/register', async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password

    const newUser = new User({
      ...userData,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
        if (error.code === 11000) { // Duplicate key error (email)
            return res.status(400).json({ message: 'Email already exists' });
        }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, 'YOUR_JWT_SECRET', { expiresIn: '1h' }); // Use environment variables!
    res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Authentication Middleware (Protect routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  jwt.verify(token, 'YOUR_JWT_SECRET', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = user; // Attach user data to the request object
    next();
  });
};

// Get User Data (Protected Route)
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password'); // Exclude password
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    res.status(200).json(user);
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Process Payment (Stripe - HIGHLY SIMPLIFIED)
app.post('/api/process-payment', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId, amount } = req.body;

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd', // or ZAR, etc. - adjust as needed
      payment_method: paymentMethodId,
      confirmation_method: 'manual', // Important for 3D Secure and other SCA requirements
      confirm: true, // Confirm the payment immediately
      // ... other options ...
      metadata: { userId: req.user.userId } // Good practice to store user ID
    });

    // Handle payment success
    res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (error) {
    console.error('Stripe payment error:', error);
      let errorMessage = 'Payment failed';
      if (error.type === 'StripeCardError') {
        errorMessage = error.message;  // Use Stripe's error message for card errors
      }
     res.status(500).json({ message: errorMessage });
  }
});

// --- Credit Report API Integration (Conceptual) ---

// Example function to fetch a credit report from TransUnion (REPLACE WITH ACTUAL API CALL)
async function getTransUnionReport(userId, idNumber) {
  // 1.  Get API credentials (from environment variables or a secure store)
  const apiKey = process.env.TRANSUNION_API_KEY;

  // 2.  Construct the API request (This is a placeholder - refer to TransUnion's API documentation)
    const requestData = {
    apiKey: apiKey,
    userId: userId, // Your internal user ID
    idNumber: idNumber, // User's ID number
    // ... other required parameters ...
  };

  // 3.  Make the API request (using axios or node-fetch)
    try{
        const response = await axios.post('https://api.transunion.com/credit-report', requestData, {
        // ... headers ...
        });
      // 4. Process the response (Check for errors, parse data)
        if (response.data.status === 'success') {
            return response.data.report; // Return the report data
        } else {
          console.error('TransUnion API error:', response.data);
          throw new Error('Failed to retrieve TransUnion report');
        }
    }catch(err){
       console.error("Error during API request:", err);
        throw new Error(`Failed to retrieve TransUnion report: ${err.message}`);
    }

}

// API endpoint to get credit reports
app.post('/api/credit-reports', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);

      if(!user || !user.idNumber) {
        return res.status(400).json({ message: "User ID number is required." });
        }

    // Fetch reports from different bureaus (in parallel if possible)
    const transUnionReport = await getTransUnionReport(userId, user.idNumber);
    // const xdsReport = await getXdsReport(userId, user.idNumber);
    // const debiCheckReport = await getDebiCheckReport(userId, user.idNumber);
    // const clearScoreReport = await getClearScoreReport(userId, user.idNumber);

    // Store the reports in the user's document (or a separate collection)
    user.creditReports.push({ source: 'TransUnion', reportData: transUnionReport });
    // user.creditReports.push({ source: 'XDS', reportData: xdsReport });
    // ... add other reports ...

    await user.save();

    res.status(200).json({ message: 'Credit reports retrieved successfully' });

    } catch (error) {
    console.error('Credit report retrieval error:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve credit reports' });
  }
});

// ... Other API endpoints (update user data, etc.) ...

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));