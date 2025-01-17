const express = require('express');

const router = express.Router();

const passport = require('passport');

const tweet = require('./modules/tweet');

const admin = require('./modules/admin');

const users = require('./modules/users');

const followships = require('./modules/followships');

const {
  authenticated,
  authenticatedAdmin,
  authenticatedUser,
} = require('../middleware/api-auth');

const { apiErrorHandler } = require('../middleware/error-handler');
const userController = require('../controllers/user-controller');
const tweetController = require('../controllers/tweet-controller');

// cors header setting middleware
// const corsSet = (req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'https://localhost:7000');
//   next();
// };

// register
router.post('/users', userController.signUp);

// login
router.post(
  '/users/signin',
  passport.authenticate('local', { session: false }),
  authenticatedUser,
  userController.signIn
);

router.post(
  '/admin/signin',
  passport.authenticate('local', { session: false }),
  authenticatedAdmin,
  userController.signIn
);
router.get('/tweets', authenticated, tweetController.getAllTweets);

router.use('/admin', authenticated, authenticatedAdmin, admin);

router.use('/users', authenticated, authenticatedUser, users);

router.use('/tweets', authenticated, authenticatedUser, tweet);

router.use('/followships', authenticated, authenticatedUser, followships);

router.get('/', (req, res) =>
  res.send(`You did not pass the authentication. Here is routes/index.js
`)
);

router.use('/', apiErrorHandler);

module.exports = router;
