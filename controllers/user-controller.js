const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUser } = require('../_helpers');
const {
  User,
  Tweet,
  Reply,
  Like,
  FollowShip,
  sequelize,
} = require('../models');
const { imgurFileHandler } = require('../helpers/file-helpers');

const userController = {
  signUp: async (req, res, next) => {
    try {
      const { account, name, email, password, checkPassword } = req.body;

      if (!account || !name || !email || !password || !checkPassword) {
        throw new Error('All fields are required');
      }

      if (password !== checkPassword) {
        throw new Error('Passwords do not match');
      }

      if (await User.findOne({ where: { account } })) {
        throw new Error('This account already exists');
      }

      if (await User.findOne({ where: { email } })) {
        throw new Error('This email already exists');
      }

      await User.create({
        account,
        name,
        email,
        password: bcrypt.hashSync(password, 10),
      });

      res.status(200).json({ message: 'User is registered successfully' });
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  signIn: async (req, res, next) => {
    try {
      const userData = getUser(req).toJSON();

      delete userData.password;

      const token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: '30d',
      });

      res
        .status(200)
        .json({ status: 'success', data: { token, user: userData } });
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  getUser: async (req, res, next) => {
    try {
      const UserId = req.params.id;
      const user = await User.findOne({
        where: { id: UserId },
        // raw: true,
        next: true,
        include: [
          {
            model: User,
            as: 'Followers',
            attributes: ['id', 'account', 'avatar', 'name'],
          },
          {
            model: User,
            as: 'Followings',
            attributes: ['id', 'account', 'avatar', 'name'],
          },
          { model: Tweet },
          { model: Reply },
          { model: Like },
        ],
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        throw new Error('User not found');
      }

      res.status(200).json(user);
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  editUserSetting: async (req, res, next) => {
    try {
      const UserId = req.params.id;
      const currentId = getUser(req).id;
      const { account, name, email, password, checkPassword } = req.body;

      const user = await User.findByPk(UserId);
      if (!user) {
        throw new Error('User not found');
      }

      if (currentId !== user.id) {
        throw new Error('You are not authorized to edit this user');
      }

      if (
        !account.trim() ||
        !name.trim() ||
        !email.trim() ||
        !password.trim() ||
        !checkPassword.trim()
      ) {
        throw new Error('All fields are required');
      }

      if (account !== user.account) {
        if (await User.findOne({ where: { account } })) {
          throw new Error('This account already exists');
        }
      }

      if (email !== user.email) {
        if (await User.findOne({ where: { email } })) {
          throw new Error('This email already exists');
        }
      }

      if (name.length > 50) {
        throw new Error('Name is longer than 50 characters');
      }

      if (password !== checkPassword) {
        throw new Error('Passwords do not match');
      }

      const userUpdated = await user.update({
        account,
        name,
        email,
        password: password ? bcrypt.hashSync(password, 10) : password,
      });

      res.status(200).json({
        status: 'success',
        message: 'User is updated successfully',
        userUpdated: {
          account: userUpdated.account,
          name: userUpdated.name,
          email: userUpdated.email,
        },
      });
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  editUserProfile: async (req, res, next) => {
    try {
      const UserId = req.params.id;
      const currentUser = getUser(req);
      const { name, introduction } = req.body;
      let avatar = req.files?.avatar || null;
      let coverImage = req.files?.cover_image || null;

      if (currentUser.id !== Number(UserId)) {
        throw new Error('You are not authorized to edit this user');
      }

      if (name.length > 50) {
        throw new Error('Name is longer than 50 characters');
      }

      if (!name.trim()) {
        throw new Error('Name is required');
      }

      if (introduction.length > 160) {
        throw new Error('Introduction is longer than 160 characters');
      }

      if (avatar) avatar = await imgurFileHandler(avatar[0]);
      if (coverImage) coverImage = await imgurFileHandler(coverImage[0]);

      const user = await User.findByPk(UserId);
      if (!user) {
        throw new Error('User not found');
      }

      const userUpdated = await user.update({
        name,
        introduction,
        avatar: avatar || currentUser.avatar,
        coverImage: coverImage || currentUser.cover_image,
      });

      res.status(200).json({
        status: 'success',
        message: 'User Profile is updated successfully',
        userUpdated: {
          name: userUpdated.name,
          introduction: userUpdated.introduction,
          avatar: userUpdated.avatar,
          cover_image: userUpdated.coverImage,
        },
      });
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  getUserTweets: async (req, res, next) => {
    try {
      const UserId = req.params.id;
      const tweets = await Tweet.findAll({
        where: { UserId },
        attributes: [
          'id',
          'description',
          'createdAt',
          'updatedAt',
          [
            sequelize.literal(
              '(SELECT COUNT(Tweet_id) FROM Replies WHERE Tweet_id = Tweet.id)'
            ),
            'RepliesCount',
          ],
          [
            sequelize.literal(
              '(SELECT COUNT(Tweet_id) FROM Likes WHERE Tweet_id = Tweet.id)'
            ),
            'LikesCount',
          ],
        ],
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['id', 'account', 'avatar', 'name'],
          },
          {
            model: Reply,
            as: 'Replies',
            attributes: ['id', 'comment', 'createdAt'],
          },
          {
            model: Like,
            as: 'Likes',
          },
        ],

        order: [['createdAt', 'DESC']],
      });

      if (!tweets) throw new Error(`This user doesn't have any tweets`);

      const likedTweetId = req.user?.LikedTweets
        ? req.user.LikedTweets.map((likeTweet) => likeTweet.id)
        : [];

      const modifiedTweets = tweets.map((tweet) => ({
        ...tweet.toJSON(),
        isLiked: likedTweetId.includes(tweet.id),
      }));

      res.status(200).json(modifiedTweets);
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
  getUserRepliedTweet: async (req, res, next) => {
    try {
      const UserId = req.params.id;
      const replies = await Reply.findAll({
        where: { UserId },
        attributes: ['id', 'comment', 'createdAt'],
        include: [
          {
            model: Tweet,
            as: 'Tweet',
            attributes: ['id', 'description', 'createdAt'],
            include: [{ model: User, attributes: ['id', 'account', 'avatar'] }],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      if (!replies) throw new Error(`This user doesn't have any replies`);

      res.status(200).json(replies);
    } catch (err) {
      err.status = 400;
      next(err);
    }
  },
};

module.exports = userController;
