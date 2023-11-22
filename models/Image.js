const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  userId: String, // To associate an image with a user
  url: String, // URL/path of the image
  createdAt: {
    type: Date,
    default: Date.now
  }
  // Add other relevant fields as needed
});

module.exports = mongoose.model('Image', ImageSchema);
