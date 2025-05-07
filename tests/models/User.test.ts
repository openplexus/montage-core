import { User } from '../../models/User';
import mongoose from 'mongoose';

describe('User Model Test', () => {
  const validUserData = {
    email: 'test@example.com',
    password: 'Test@123',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser'
  };

  it('should create a valid user', async () => {
    const user = await User.create(validUserData);
    expect(user.email).toBe(validUserData.email);
    expect(user.firstName).toBe(validUserData.firstName);
    expect(user.lastName).toBe(validUserData.lastName);
    expect(user.username).toBe(validUserData.username);
    expect(user.password).not.toBe(validUserData.password); // Should be hashed
  });

  describe('Email Validation', () => {
    it('should fail with invalid email format', async () => {
      const invalidEmail = { ...validUserData, email: 'invalid-email' };
      await expect(User.create(invalidEmail)).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      await User.create(validUserData);
      await expect(User.create(validUserData)).rejects.toThrow();
    });
  });

  describe('Username Validation', () => {
    it('should fail with short username', async () => {
      const shortUsername = { ...validUserData, username: 'ab' };
      await expect(User.create(shortUsername)).rejects.toThrow();
    });

    it('should fail with long username', async () => {
      const longUsername = { ...validUserData, username: 'a'.repeat(31) };
      await expect(User.create(longUsername)).rejects.toThrow();
    });

    it('should fail with invalid characters', async () => {
      const invalidUsername = { ...validUserData, username: 'test@user' };
      await expect(User.create(invalidUsername)).rejects.toThrow();
    });

    it('should fail with consecutive special characters', async () => {
      const invalidUsername = { ...validUserData, username: 'test__user' };
      await expect(User.create(invalidUsername)).rejects.toThrow();
    });

    it('should fail with duplicate username', async () => {
      await User.create(validUserData);
      const duplicateUser = {
        ...validUserData,
        email: 'another@example.com'
      };
      await expect(User.create(duplicateUser)).rejects.toThrow();
    });
  });

  describe('Password Validation', () => {
    it('should fail with short password', async () => {
      const shortPassword = { ...validUserData, password: 'Short1!' };
      await expect(User.create(shortPassword)).rejects.toThrow();
    });

    it('should fail without uppercase letter', async () => {
      const noUppercase = { ...validUserData, password: 'test123!' };
      await expect(User.create(noUppercase)).rejects.toThrow();
    });

    it('should fail without lowercase letter', async () => {
      const noLowercase = { ...validUserData, password: 'TEST123!' };
      await expect(User.create(noLowercase)).rejects.toThrow();
    });

    it('should fail without number', async () => {
      const noNumber = { ...validUserData, password: 'TestPass!' };
      await expect(User.create(noNumber)).rejects.toThrow();
    });

    it('should fail without special character', async () => {
      const noSpecial = { ...validUserData, password: 'TestPass123' };
      await expect(User.create(noSpecial)).rejects.toThrow();
    });
  });

  describe('Name Validation', () => {
    it('should fail with invalid firstName characters', async () => {
      const invalidFirstName = { ...validUserData, firstName: 'Test123' };
      await expect(User.create(invalidFirstName)).rejects.toThrow();
    });

    it('should fail with invalid lastName characters', async () => {
      const invalidLastName = { ...validUserData, lastName: 'User123' };
      await expect(User.create(invalidLastName)).rejects.toThrow();
    });

    it('should fail with short firstName', async () => {
      const shortFirstName = { ...validUserData, firstName: 'T' };
      await expect(User.create(shortFirstName)).rejects.toThrow();
    });

    it('should fail with short lastName', async () => {
      const shortLastName = { ...validUserData, lastName: 'U' };
      await expect(User.create(shortLastName)).rejects.toThrow();
    });
  });

  describe('Password Comparison', () => {
    it('should correctly compare valid password', async () => {
      const user = await User.create(validUserData);
      const isMatch = await user.comparePassword(validUserData.password);
      expect(isMatch).toBe(true);
    });

    it('should correctly compare invalid password', async () => {
      const user = await User.create(validUserData);
      const isMatch = await user.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });
  });
}); 