require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./Users');
const Movie = require('./Movies');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

const router = express.Router();

// SIGNUP
router.post('/signup', async (req, res) => {
  if (!req.body.username || !req.body.password || !req.body.name) {
    return res.status(400).json({
      success: false,
      msg: 'Please include name, username, and password to signup.',
    });
  }

  try {
    const user = new User({
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save();

    res.status(201).json({
      success: true,
      msg: 'Successfully created new user.',
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A user with that username already exists.',
      });
    } else {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: 'Something went wrong. Please try again later.',
      });
    }
  }
});

// SIGNIN
router.post('/signin', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username }).select(
      'name username password'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        msg: 'Authentication failed. User not found.',
      });
    }

    const isMatch = await user.comparePassword(req.body.password);

    if (isMatch) {
      const userToken = { id: user._id, username: user.username };
      const token = jwt.sign(userToken, process.env.SECRET_KEY, {
        expiresIn: '1h',
      });

      res.json({
        success: true,
        token: 'JWT ' + token,
      });
    } else {
      res.status(401).json({
        success: false,
        msg: 'Authentication failed. Incorrect password.',
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
});

// GET all movies
router.route('/movies')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movies = await Movie.find({});
      return res.status(200).json(movies);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: 'Failed to get movies.',
      });
    }
  })

  // POST one movie
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const { title, releaseDate, genre, actors } = req.body;

      if (!title || !releaseDate || !genre || !actors || actors.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Movie is missing required information.',
        });
      }

      const movie = new Movie({
        title,
        releaseDate,
        genre,
        actors,
      });

      const savedMovie = await movie.save();
      return res.status(201).json(savedMovie);
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: 'Failed to save movie.',
      });
    }
  });

// GET one movie by title
router.get('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movie = await Movie.findOne({ title: req.params.movieparameter });

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found.',
      });
    }

    return res.status(200).json(movie);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get movie.',
    });
  }
});

// PUT update movie by title
router.put('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const updatedMovie = await Movie.findOneAndUpdate(
      { title: req.params.movieparameter },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedMovie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found.',
      });
    }

    return res.status(200).json(updatedMovie);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update movie.',
    });
  }
});

// DELETE movie by title
router.delete('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const deletedMovie = await Movie.findOneAndDelete({
      title: req.params.movieparameter,
    });

    if (!deletedMovie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Movie deleted successfully.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete movie.',
    });
  }
});

app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;