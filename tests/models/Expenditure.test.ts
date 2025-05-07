import mongoose from 'mongoose';
import { Expenditure } from '../../models/Expenditure';
import { User } from '../../models/User';

describe('Expenditure Model Test', () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'Test@123',
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser'
    });
    userId = user._id as mongoose.Types.ObjectId;
  });

  it('should create a valid expenditure', async () => {
    const validExpenditure = {
      user: userId,
      amount: 100,
      category: 'food',
      description: 'Lunch',
      date: new Date(),
      paymentMethod: 'cash',
      tags: ['meal', 'work'],
      location: 'Office',
      totalAmount: 100,
      paidBy: userId
    };

    const expenditure = await Expenditure.create(validExpenditure);
    expect(expenditure.amount).toBe(100);
    expect(expenditure.category).toBe('food');
    expect(expenditure.tags).toHaveLength(2);
  });

  it('should fail with invalid category', async () => {
    const invalidExpenditure = {
      user: userId,
      amount: 100,
      category: 'invalid_category',
      description: 'Test',
      date: new Date(),
      paymentMethod: 'cash',
      totalAmount: 100,
      paidBy: userId
    };

    await expect(Expenditure.create(invalidExpenditure)).rejects.toThrow();
  });

  it('should validate split amounts match total amount', async () => {
    const friend = await User.create({
      email: 'friend@example.com',
      password: 'Friend@123',
      firstName: 'Friend',
      lastName: 'Test',
      username: 'friendtest'
    });

    const expenditureWithSplits = {
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
          user: friend._id,
          amount: 60,
          paid: false
        },
        {
          user: userId,
          amount: 40,
          paid: true
        }
      ]
    };

    const expenditure = await Expenditure.create(expenditureWithSplits);
    expect(expenditure.splits).toHaveLength(2);
    expect(expenditure.isSettled).toBe(false);
  });

  it('should reject when split amounts do not match total', async () => {
    const expenditureWithInvalidSplits = {
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
          user: new mongoose.Types.ObjectId(),
          amount: 70,
          paid: false
        },
        {
          user: userId,
          amount: 40,
          paid: true
        }
      ]
    };

    await expect(Expenditure.create(expenditureWithInvalidSplits)).rejects.toThrow();
  });
}); 