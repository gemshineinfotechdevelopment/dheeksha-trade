import mongoose, { Schema, Document } from 'mongoose';

export interface IAccountLedger extends Document {
  particularId?: string;
  billNo?: string;
  performaId?: string;
  performaNumber?: string;
  customerName: string;
  date: string;
  companyName?: string;
  debit: string;
  credit: string;
  balance: string;
  paymentMode?: string;
  reference?: string;
  notes?: string;
  type: 'BILL' | 'CREDIT' | 'PAYMENT' | 'ADVANCE';
  createdAt: Date;
  updatedAt: Date;
}

const AccountLedgerSchema: Schema = new Schema(
  {
    particularId: { type: String, trim: true },
    billNo: { type: String, trim: true },
    performaId: { type: String, trim: true },
    performaNumber: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    companyName: { type: String, default: '', trim: true },
    debit: { type: String, default: '0.00' },
    credit: { type: String, default: '0.00' },
    balance: { type: String, default: '0.00' },
    paymentMode: { type: String, trim: true, default: 'Bank' },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['BILL', 'CREDIT', 'PAYMENT', 'ADVANCE'], default: 'BILL' },
  },
  { timestamps: true }
);

export const AccountLedger = mongoose.model<IAccountLedger>('AccountLedger', AccountLedgerSchema);
