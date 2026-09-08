const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_scm';
    const conn = await mongoose.connect(mongoUri, {
      dbName: 'smart_scm'
    });
    console.log(`MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
