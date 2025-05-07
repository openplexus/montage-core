import { Router, Response, Request, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { User, IUser } from '../models/User';
import { auth, generateToken, AuthRequest } from '../middleware/auth';

export const usersRouter = Router();

/* GET users listing. */
usersRouter.get('/', function(req: any, res: any) {
  res.send('respond with a resource');
});

interface RegisterResponse {
  user: IUser;
  token: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// Register a new user
const register: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { email, password, firstName, lastName, username } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email },
        { username }
      ]
    });
    
    if (existingUser) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: {
          [existingUser.email === email ? 'email' : 'username']: 
          `This ${existingUser.email === email ? 'email' : 'username'} is already registered`
        }
      });
      return;
    }

    const user = await User.create({ email, password, firstName, lastName, username });
    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      // Handle mongoose validation errors
      const validationErrors = (error as any).errors;
      const errorMessages: { [key: string]: string } = {};
      
      Object.keys(validationErrors).forEach(field => {
        errorMessages[field] = validationErrors[field].message;
      });

      res.status(400).json({
        error: 'Validation failed',
        details: errorMessages
      });
      return;
    }
    next(error);
  }
};

// Login user
const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid login credentials' });
      return;
    }

    const token = generateToken(user.id);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
};

// Get current user profile (protected route)
const getProfile: RequestHandler = (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json(authReq.user);
  } catch (error) {
    next(error);
  }
};

// Update user profile (protected route)
const updateProfile: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const updates = Object.keys(req.body);
    const allowedUpdates = ['email', 'password', 'firstName', 'lastName', 'username'] as const;
    const isValidOperation = updates.every(update => allowedUpdates.includes(update as typeof allowedUpdates[number]));

    if (!isValidOperation) {
      res.status(400).json({ error: 'Invalid updates' });
      return;
    }

    if (!authReq.user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check if username or email is being updated and if it's already taken
    if (req.body.username || req.body.email) {
      const existingUser = await User.findOne({
        _id: { $ne: authReq.user._id }, // exclude current user
        $or: [
          ...(req.body.email ? [{ email: req.body.email }] : []),
          ...(req.body.username ? [{ username: req.body.username }] : [])
        ]
      });

      if (existingUser) {
        res.status(400).json({ 
          error: 'Validation failed',
          details: {
            [existingUser.email === req.body.email ? 'email' : 'username']: 
            `This ${existingUser.email === req.body.email ? 'email' : 'username'} is already taken`
          }
        });
        return;
      }
    }

    updates.forEach(update => {
      if (allowedUpdates.includes(update as typeof allowedUpdates[number])) {
        (authReq.user as any)[update] = req.body[update];
      }
    });
    
    await authReq.user.save();
    res.json(authReq.user);
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      const validationErrors = (error as any).errors;
      const errorMessages: { [key: string]: string } = {};
      
      Object.keys(validationErrors).forEach(field => {
        errorMessages[field] = validationErrors[field].message;
      });

      res.status(400).json({
        error: 'Validation failed',
        details: errorMessages
      });
      return;
    }
    next(error);
  }
};

// Logout user (protected route)
const logout: RequestHandler = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// Routes
usersRouter.post('/register', register);
usersRouter.post('/login', login);
usersRouter.get('/me', auth, getProfile);
usersRouter.patch('/me', auth, updateProfile);
usersRouter.post('/logout', auth, logout);
