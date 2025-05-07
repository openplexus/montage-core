import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthRequest extends Request {
  user?: IUser & { _id: mongoose.Types.ObjectId };
  token?: string;
}

export const generateToken = (userId: string): string => {
  const options = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  };
  return jwt.sign({ userId }, JWT_SECRET, options);
};

export const auth: RequestHandler = async (req: AuthRequest, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Invalid token format. Use Bearer scheme' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await User.findById(decoded.userId).exec();

      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      req.user = user as IUser & { _id: mongoose.Types.ObjectId };
      req.token = token;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token has expired' });
        return;
      } else if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}; 