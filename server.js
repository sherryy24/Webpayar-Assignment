const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const Image = require('./models/Image');

require('./passport-setup');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('./public'));

app.use(session({
    secret: 'secret', // Replace with a real secret in production
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Basic route for testing
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Callback route for Google to redirect to
app.get('/auth/google/redirect', passport.authenticate('google'), (req, res) => {
    // Authentication successful, redirect home.
    res.redirect('/');
});



// Route to start OAuth flow
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    console.log("Authentication check:", req.isAuthenticated());
    res.redirect('/auth/google'); // Redirect to Google authentication if not authenticated
}


app.get('/home', ensureAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
  });
  
  

// Set storage engine for regular uploads
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize upload for regular images
const upload = multer({
    storage: storage,
    limits:{fileSize: 1000000}, // 1MB limit
    fileFilter: function(req, file, cb){
      checkFileType(file, cb);
    }
}).single('myImage');

// Initialize upload for cropped images
const uploadCropped = multer({ storage: multer.memoryStorage() });

// Check file type
function checkFileType(file, cb){
    // Allowed file extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
      return cb(null,true);
    } else {
      cb('Error: Images Only!');
    }
}

// Route to handle the POST request from the form for normal image upload
 // Adjust the path as needed

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).send('Error: ' + err);
        }

        if (!req.file) {
            console.error('No file selected');
            return res.status(400).send('Error: No File Selected');
        }

        const imagePath = req.file.path;
        const outputImagePath = path.join(__dirname, 'public', 'uploads', Date.now() + '.webp');

        console.log('Processing image:', imagePath, 'to', outputImagePath);

        sharp(imagePath)
            .resize(800)
            .toFormat('webp')
            .webp({ quality: 80 })
            .toFile(outputImagePath, (sharpErr, info) => {
                if (sharpErr) {
                    console.error('Error processing image:', sharpErr);
                    return res.status(500).send('Error processing image: ' + sharpErr);
                }

                console.log('Image processed successfully:', info);
                 
                
                // Save information about the processed image to MongoDB
                const newImage = new Image({
                    userId: req.user.id,
                    
                    url: `/uploads/${Date.now()}.webp` 
                });
                console.log(req.user, 'req info');
                newImage.save()
                    .then(savedImage => {
                        console.log('Image saved:', savedImage);
                        res.send('File Uploaded and Processed Successfully');
                    })
                    .catch(saveErr => {
                        console.error('Error saving image to MongoDB:', saveErr);
                        res.status(500).send('Error saving image to MongoDB: ' + saveErr);
                    });
            });
    });
});


// Handle cropped image upload
app.post('/upload-cropped', uploadCropped.single('croppedImage'), (req, res) => {
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded.');
    }

    // Generate a filename for the .webp image
    const filename = 'cropped-' + Date.now() + '.webp';
    const outputImagePath = path.join(__dirname, 'public', 'uploads', filename);

    // Convert to .webp using Sharp
    sharp(req.file.buffer)
        .resize(800) // Resize if needed
        .toFormat('webp')
        .webp({ quality: 80 })
        .toFile(outputImagePath, (sharpErr, info) => {
            if (sharpErr) {
                console.error('Error processing image:', sharpErr);
                return res.status(500).send('Error processing image: ' + sharpErr);
            }

            console.log('Cropped image processed successfully:', info);

            // Save information about the processed image to MongoDB
            const newImage = new Image({
                userId: req.user ? req.user.id : 'default-user-id', // Fallback if req.user is not available
                url: `/uploads/${filename}` // Adjust the URL as needed
            });

            newImage.save()
                .then(savedImage => {
                    console.log('Cropped image saved:', savedImage);
                    res.send('Cropped file uploaded and processed successfully.');
                })
                .catch(saveErr => {
                    console.error('Error saving cropped image to MongoDB:', saveErr);
                    res.status(500).send('Error saving cropped image to MongoDB: ' + saveErr);
                });
        });
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// send the list of image URLs to the client.



  

  

  // Connect to MongoDB
  mongoose.connect('mongodb+srv://nishumgupta24:1234567890@cluster0.pdaazml.mongodb.net/?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));


//route to fetch images from MongoDB:

app.get('/gallery-page', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/gallery.html'));
});

app.get('/gallery', ensureAuthenticated, (req, res) => {
    // Ensure the user is authenticated before fetching images
    if (!req.user) {
        return res.status(401).send('User not authenticated');
    }

    Image.find({ userId: req.user.id }) // Fetch images for the logged-in user
        .then(images => {
            // Transform the data to only send necessary information
            const transformedImages = images.map(image => {
                return { url: image.url };
            });
            res.json(transformedImages);
        })
        .catch(err => {
            console.error('Error fetching images from MongoDB:', err);
            res.status(500).json({ error: err.message });
        });
});

// app.get('/gallery', (req, res) => {
//     res.json([{ url: '/uploads/cropped-1700641858799.webp' }]);
// });
  