const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/config");
const User = require("../models/user");
const Comment = require("../models/comment");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require("../utils/errors");

module.exports.createUser = (req, res, next) => {
  const { name, email, password } = req.body;

  bcrypt
    .hash(password, 10)
    .then((hash) => User.create({ name, email, password: hash, page: 0 }))
    .then((user) => {
      const userSansPassword = user.toObject();
      delete userSansPassword.password;
      res.status(201).send({ data: userSansPassword });
    })
    .catch((err) => {
      if (err.name === "CastError" || err.name === "ValidationError") {
        next(new BadRequestError("Invalid input data"));
      } else if (err.name === "MongoServerError") {
        next(new ConflictError("Could not create user"));
      } else {
        next(err);
      }
    });
};

module.exports.login = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    next(new BadRequestError("Invalid email or password"));
  }
  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    })
    .catch((err) => {
      if (err.message === "Incorrect email or password") {
        next(new UnauthorizedError("Invalid email or password"));
      } else {
        next(err);
      }
    });
};

module.exports.getCurrentUser = (req, res, next) => {
  User.findById(req.user._id)
    .orFail()
    .then((user) => res.send({ data: user }))
    .catch((err) => {
      if (err.name === "CastError") {
        next(new BadRequestError("The id string is in an invalid format"));
      } else if (err.name === "DocumentNotFoundError") {
        next(new NotFoundError("User was not found"));
      } else {
        next(err);
      }
    });
};

module.exports.patchCurrentUser = (req, res, next) => {
  const { name, email, page } = req.body;
  User.findByIdAndUpdate(
    req.user._id,
    { name, email, page },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => {
      if (name) {
        Comment.updateMany({ user: req.user._id }, { $set: { name } })
          .then(() => res.send({ data: user }))
          .catch(next);
      } else {
        res.send({ data: user });
      }
    })
    .catch((err) => {
      if (err.name === "CastError" || err.name === "ValidationError") {
        next(new BadRequestError("Invalid input data"));
      } else if (err.name === "DocumentNotFoundError") {
        next(new NotFoundError("User not found"));
      } else {
        next(err);
      }
    });
};
