import request from 'supertest';
import mongoose from 'mongoose';
import app = require('../../app');
import { User } from '../../models/User';
import { Expenditure } from '../../models/Expenditure';
import jwt from 'jsonwebtoken';

describe('Expenditure Routes', () => {
  let token: string;
  let userId: mongoose.Types.ObjectId;
  let friendId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Create test user with unique email
    const timestamp = new Date().getTime();
    const user = await User.create({
      email: `test${timestamp}@example.com`,
      password: 'Test@123',
      firstName: 'Test',
      lastName: 'User',
      username: `testuser${timestamp}`
    });
    userId = user._id as mongoose.Types.ObjectId;

    // Create friend user with unique email
    const friend = await User.create({
      email: `friend${timestamp}@example.com`,
      password: 'Friend@123',
      firstName: 'Friend',
      lastName: 'Test',
      username: `friendtest${timestamp}`
    });
    friendId = friend._id as mongoose.Types.ObjectId;

    // Generate token
    token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret');
  });

  describe('POST /expenditures', () => {
    it('should create a new expenditure', async () => {
      const response = await request(app)
        .post('/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          category: 'food',
          description: 'Lunch',
          date: new Date(),
          paymentMethod: 'cash',
          tags: ['meal', 'work'],
          location: 'Office',
          totalAmount: 100
        });

      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(100);
      expect(response.body.category).toBe('food');
    });

    it('should create an expenditure with splits', async () => {
      const response = await request(app)
        .post('/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          category: 'food',
          description: 'Dinner',
          date: new Date(),
          paymentMethod: 'cash',
          totalAmount: 100,
          splits: [
            {
              user: friendId,
              amount: 60,
              paid: false
            },
            {
              user: userId,
              amount: 40,
              paid: true
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.splits).toHaveLength(2);
      expect(response.body.isSettled).toBe(false);
    });
  });

  describe('GET /expenditures', () => {
    beforeEach(async () => {
      // Create test expenditures
      await Expenditure.create([
        {
          user: userId,
          amount: 100,
          category: 'food',
          description: 'Lunch',
          date: new Date(),
          paymentMethod: 'cash',
          totalAmount: 100,
          paidBy: userId
        },
        {
          user: userId,
          amount: 200,
          category: 'transportation',
          description: 'Taxi',
          date: new Date(),
          paymentMethod: 'credit_card',
          totalAmount: 200,
          paidBy: userId
        }
      ]);
    });

    it('should get all expenditures with pagination', async () => {
      const response = await request(app)
        .get('/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.expenditures).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter expenditures by category', async () => {
      const response = await request(app)
        .get('/expenditures')
        .set('Authorization', `Bearer ${token}`)
        .query({ category: 'food' });

      expect(response.status).toBe(200);
      expect(response.body.expenditures).toHaveLength(1);
      expect(response.body.expenditures[0].category).toBe('food');
    });
  });

  describe('GET /expenditures/statistics', () => {
    it('should get expenditure statistics', async () => {
      const response = await request(app)
        .get('/expenditures/statistics')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('byMonth');
    });
  });

  describe('POST /expenditures/:expenditureId/mark-paid', () => {
    let expenditureId: string;

    beforeEach(async () => {
      const expenditure = await Expenditure.create({
        user: userId,
        amount: 100,
        category: 'food',
        description: 'Dinner',
        date: new Date(),
        paymentMethod: 'cash',
        totalAmount: 100,
        paidBy: userId,
        splits: [
          {
            user: friendId,
            amount: 60,
            paid: false
          },
          {
            user: userId,
            amount: 40,
            paid: true
          }
        ]
      });
      expenditureId = (expenditure._id as mongoose.Types.ObjectId).toString();
    });

    it('should mark a split as paid', async () => {
      const friendToken = jwt.sign({ userId: friendId }, process.env.JWT_SECRET || 'test-secret');
      
      const response = await request(app)
        .post(`/expenditures/${expenditureId}/mark-paid`)
        .set('Authorization', `Bearer ${friendToken}`);

      expect(response.status).toBe(200);
      expect(response.body.splits[0].paid).toBe(true);
      expect(response.body.splits[0].settledAt).toBeDefined();
    });
  });
}); 