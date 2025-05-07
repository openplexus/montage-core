import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User';
import { auth, generateToken, AuthRequest } from '../../middleware/auth';
import mongoose from 'mongoose';

const TEST_JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = TEST_JWT_SECRET;

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      header: jest.fn()
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    nextFunction = jest.fn();
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
      const token = generateToken(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as { userId: string };
      expect(decoded.userId).toBe(userId);
    });
  });

  describe('Authentication Middleware', () => {
    it('should fail when no authorization header is provided', async () => {
      mockRequest.header = jest.fn().mockReturnValue(undefined);

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No authorization token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should fail when authorization header has invalid format', async () => {
      mockRequest.header = jest.fn().mockReturnValue('InvalidFormat token123');

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token format. Use Bearer scheme'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should fail when token is invalid', async () => {
      mockRequest.header = jest.fn().mockReturnValue('Bearer invalid.token.here');

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should fail when user is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const token = generateToken(nonExistentId.toString());
      mockRequest.header = jest.fn().mockReturnValue(`Bearer ${token}`);

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should succeed with valid token and existing user', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser'
      });

      const token = generateToken((user._id as mongoose.Types.ObjectId).toString());
      mockRequest.header = jest.fn().mockReturnValue(`Bearer ${token}`);

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.token).toBe(token);
    });

    it('should fail with expired token', async () => {
      const user = await User.create({
        email: 'expired@example.com',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
        username: 'expireduser'
      });

      const token = jwt.sign(
        { userId: user._id },
        TEST_JWT_SECRET,
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      mockRequest.header = jest.fn().mockReturnValue(`Bearer ${token}`);

      await auth(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token has expired'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
}); 