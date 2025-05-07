import mongoose from 'mongoose';

interface Split {
  user: mongoose.Types.ObjectId;
  amount: number;
  paid: boolean;
  settledAt?: Date;
}

export interface IExpenditure extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  category: string;
  description: string;
  date: Date;
  paymentMethod: string;
  tags: string[];
  location?: string;
  splits: Split[];
  totalAmount: number;  // Total amount including all splits
  paidBy: mongoose.Types.ObjectId;  // User who paid the bill
  isSettled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Split amount cannot be negative']
  },
  paid: {
    type: Boolean,
    default: false
  },
  settledAt: {
    type: Date
  }
});

const expenditureSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: [
        'food',
        'transportation',
        'housing',
        'utilities',
        'healthcare',
        'entertainment',
        'shopping',
        'education',
        'personal_care',
        'debt_payments',
        'savings',
        'gifts',
        'other'
      ],
      message: '{VALUE} is not a valid category'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer', 'other'],
      message: '{VALUE} is not a valid payment method'
    }
  },
  tags: {
    type: [String],
    validate: {
      validator: function(tags: string[]) {
        return tags.every(tag => tag.length <= 20);
      },
      message: 'Each tag must be 20 characters or less'
    }
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  splits: {
    type: [splitSchema],
    default: []
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isSettled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Validate that splits add up to total amount
expenditureSchema.pre('save', function(next) {
  if (this.splits.length > 0) {
    const totalSplitAmount = this.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplitAmount - this.totalAmount) > 0.01) { // Using 0.01 to handle floating point precision
      next(new Error('Split amounts must add up to the total amount'));
      return;
    }
  }
  next();
});

// Index for efficient queries
expenditureSchema.index({ user: 1, date: -1 });
expenditureSchema.index({ user: 1, category: 1 });
expenditureSchema.index({ user: 1, tags: 1 });
expenditureSchema.index({ 'splits.user': 1, 'splits.paid': 1 });
expenditureSchema.index({ paidBy: 1, isSettled: 1 });

export const Expenditure = mongoose.model<IExpenditure>('Expenditure', expenditureSchema); 