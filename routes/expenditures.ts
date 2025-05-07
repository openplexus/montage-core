import { Router, RequestHandler } from 'express';
import { AuthRequest, auth } from '../middleware/auth';
import { Expenditure, IExpenditure } from '../models/Expenditure';
import { IUser } from '../models/User';
import mongoose from 'mongoose';

export const expendituresRouter = Router();

interface Split {
  user: mongoose.Types.ObjectId;
  amount: number;
  paid: boolean;
  settledAt?: Date;
}

// Create a new expenditure
const createExpenditure: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { splits, totalAmount, ...expenditureData } = req.body;

    // Create expenditure with splits
    const expenditure = await Expenditure.create({
      ...expenditureData,
      user: authReq.user!._id,
      paidBy: authReq.user!._id,
      totalAmount: totalAmount || expenditureData.amount,
      splits: splits || []
    });

    // Populate user information for splits
    await expenditure.populate('splits.user', 'username firstName lastName email');
    
    res.status(201).json(expenditure);
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

// Get all expenditures with enhanced split information
const getExpenditures: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const category = req.query.category as string;
    const tag = req.query.tag as string;
    const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
    const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;
    const splitType = req.query.splitType as 'paid' | 'owed' | 'all';
    const isSettled = req.query.isSettled === 'true';

    // Build query
    const query: any = {
      $or: [
        { user: authReq.user!._id },
        { 'splits.user': authReq.user!._id }
      ]
    };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (minAmount || maxAmount) {
      query.totalAmount = {};
      if (minAmount) query.totalAmount.$gte = minAmount;
      if (maxAmount) query.totalAmount.$lte = maxAmount;
    }

    // Handle split type filtering
    if (splitType === 'paid') {
      query.paidBy = authReq.user!._id;
    } else if (splitType === 'owed') {
      query['splits.user'] = authReq.user!._id;
      query.paidBy = { $ne: authReq.user!._id };
    }

    if (req.query.isSettled !== undefined) {
      query.isSettled = isSettled;
    }

    // Execute query with pagination and populate user information
    const [expenditures, total] = await Promise.all([
      Expenditure.find(query)
        .populate('paidBy', 'username firstName lastName email')
        .populate('splits.user', 'username firstName lastName email')
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Expenditure.countDocuments(query)
    ]);

    // Calculate summary statistics
    const summary = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          avgAmount: { $avg: '$totalAmount' },
          maxAmount: { $max: '$totalAmount' },
          minAmount: { $min: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate split summary for the user
    const splitSummary = await Expenditure.aggregate([
      {
        $match: {
          isSettled: false,
          $or: [
            { paidBy: authReq.user!._id },
            { 'splits.user': authReq.user!._id }
          ]
        }
      },
      {
        $project: {
          paidBy: 1,
          totalAmount: 1,
          splits: {
            $filter: {
              input: '$splits',
              as: 'split',
              cond: { $eq: ['$$split.user', authReq.user!._id] }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ['$paidBy', authReq.user!._id] },
                '$totalAmount',
                0
              ]
            }
          },
          totalOwed: {
            $sum: {
              $cond: [
                { $eq: ['$paidBy', authReq.user!._id] },
                0,
                { $arrayElemAt: ['$splits.amount', 0] }
              ]
            }
          }
        }
      }
    ]);

    res.json({
      expenditures,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total
      },
      summary: summary[0] || {
        totalAmount: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0,
        count: 0
      },
      splitSummary: splitSummary[0] || {
        totalPaid: 0,
        totalOwed: 0,
        balance: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get a single expenditure by ID
const getExpenditure: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const expenditure = await Expenditure.findOne({
      _id: req.params.id,
      user: authReq.user!._id
    });

    if (!expenditure) {
      res.status(404).json({ error: 'Expenditure not found' });
      return;
    }

    res.json(expenditure);
  } catch (error) {
    next(error);
  }
};

// Update an expenditure
const updateExpenditure: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const updates = Object.keys(req.body);
    const allowedUpdates = ['amount', 'category', 'description', 'date', 'paymentMethod', 'tags', 'location'] as const;
    const isValidOperation = updates.every(update => allowedUpdates.includes(update as typeof allowedUpdates[number]));

    if (!isValidOperation) {
      res.status(400).json({ error: 'Invalid updates' });
      return;
    }

    const expenditure = await Expenditure.findOne({
      _id: req.params.id,
      user: authReq.user!._id
    });

    if (!expenditure) {
      res.status(404).json({ error: 'Expenditure not found' });
      return;
    }

    updates.forEach(update => {
      (expenditure as any)[update] = req.body[update];
    });

    await expenditure.save();
    res.json(expenditure);
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

// Delete an expenditure
const deleteExpenditure: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const expenditure = await Expenditure.findOneAndDelete({
      _id: req.params.id,
      user: authReq.user!._id
    });

    if (!expenditure) {
      res.status(404).json({ error: 'Expenditure not found' });
      return;
    }

    res.json({ message: 'Expenditure deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get expenditure statistics
const getStatistics: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const query: any = { user: authReq.user!._id };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const statistics = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const monthlyStats = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    res.json({
      overall: statistics[0] || {
        totalAmount: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0,
        count: 0
      },
      byCategory: categoryStats,
      byMonth: monthlyStats
    });
  } catch (error) {
    next(error);
  }
};

// Mark a split as paid
const markSplitAsPaid: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { expenditureId } = req.params;

    const expenditure = await Expenditure.findOne({
      _id: expenditureId,
      'splits.user': authReq.user!._id,
      isSettled: false
    }).exec();

    if (!expenditure) {
      res.status(404).json({ error: 'Expenditure not found or already settled' });
      return;
    }

    // Find and update the user's split
    const split = expenditure.splits.find(
      (s: Split) => s.user.toString() === authReq.user!._id.toString()
    );

    if (!split) {
      res.status(404).json({ error: 'Split not found for this user' });
      return;
    }

    split.paid = true;
    split.settledAt = new Date();

    // Check if all splits are paid
    const allPaid = expenditure.splits.every((s: Split) => s.paid);
    if (allPaid) {
      expenditure.isSettled = true;
    }

    await expenditure.save();
    await expenditure.populate('splits.user', 'username firstName lastName email');

    res.json(expenditure);
  } catch (error) {
    next(error);
  }
};

// Get settlement summary
const getSettlementSummary: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;

    const summary = await Expenditure.aggregate([
      {
        $match: {
          isSettled: false,
          $or: [
            { paidBy: authReq.user!._id },
            { 'splits.user': authReq.user!._id }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'paidBy',
          foreignField: '_id',
          as: 'paidByUser'
        }
      },
      {
        $unwind: '$paidByUser'
      },
      {
        $project: {
          paidBy: 1,
          paidByUser: {
            _id: 1,
            username: 1,
            firstName: 1,
            lastName: 1,
            email: 1
          },
          totalAmount: 1,
          splits: 1,
          date: 1,
          description: 1
        }
      },
      {
        $group: {
          _id: {
            userId: {
              $cond: [
                { $eq: ['$paidBy', authReq.user!._id] },
                { $arrayElemAt: ['$splits.user', 0] },
                '$paidBy'
              ]
            }
          },
          totalOwed: {
            $sum: {
              $cond: [
                { $eq: ['$paidBy', authReq.user!._id] },
                { $arrayElemAt: ['$splits.amount', 0] },
                {
                  $multiply: [
                    {
                      $let: {
                        vars: {
                          userSplit: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$splits',
                                  as: 'split',
                                  cond: { $eq: ['$$split.user', authReq.user!._id] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: '$$userSplit.amount'
                      }
                    },
                    -1
                  ]
                }
              ]
            }
          },
          transactions: {
            $push: {
              _id: '$_id',
              description: '$description',
              amount: {
                $cond: [
                  { $eq: ['$paidBy', authReq.user!._id] },
                  { $arrayElemAt: ['$splits.amount', 0] },
                  {
                    $multiply: [
                      {
                        $let: {
                          vars: {
                            userSplit: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$splits',
                                    as: 'split',
                                    cond: { $eq: ['$$split.user', authReq.user!._id] }
                                  }
                                },
                                0
                              ]
                            }
                          },
                          in: '$$userSplit.amount'
                        }
                      },
                      -1
                    ]
                  }
                ]
              },
              date: '$date'
            }
          },
          userDetails: { $first: '$paidByUser' }
        }
      },
      {
        $match: {
          totalOwed: { $ne: 0 }
        }
      },
      {
        $sort: {
          totalOwed: -1
        }
      }
    ]);

    res.json({
      settlements: summary,
      summary: {
        totalToReceive: summary
          .filter(s => s.totalOwed > 0)
          .reduce((sum, s) => sum + s.totalOwed, 0),
        totalToPay: summary
          .filter(s => s.totalOwed < 0)
          .reduce((sum, s) => sum + Math.abs(s.totalOwed), 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Routes
expendituresRouter.post('/', auth, createExpenditure);
expendituresRouter.get('/', auth, getExpenditures);
expendituresRouter.get('/statistics', auth, getStatistics);
expendituresRouter.get('/settlements', auth, getSettlementSummary);
expendituresRouter.post('/:expenditureId/mark-paid', auth, markSplitAsPaid);
expendituresRouter.get('/:id', auth, getExpenditure);
expendituresRouter.patch('/:id', auth, updateExpenditure);
expendituresRouter.delete('/:id', auth, deleteExpenditure); 