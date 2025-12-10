const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoute = require('./routes/auth');

dotenv.config();
const app = express();

app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173', 
  process.env.CLIENT_URL 
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.use('/api/auth', authRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}!`);
});