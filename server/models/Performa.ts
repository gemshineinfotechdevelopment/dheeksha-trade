import mongoose, { Schema, Document } from 'mongoose';

export interface IPerformaProductItem {
  productId?: mongoose.Types.ObjectId | string;
  productSnapshot: {
    productCode?: string;
    productName: string;
    companyName?: string;
    category?: string;
  };
  requiredCases: number;
  usedCases: number;
  remainingCases: number;
  caseOut: number;
  rate: number;
  pktPerUnit: number;
  allocatedAmount: number;
  usedAmount: number;
  remainingAmount: number;
}

export type PerformaStatus = 'ACTIVE' | 'PARTIALLY_USED' | 'COMPLETED' | 'CANCELLED';

export interface IPerforma extends Document {
  performaNumber: string;
  customerId: mongoose.Types.ObjectId | string;
  companyName?: string;
  customerSnapshot: {
    name: string;
    phone: string;
    companyName: string;
    address: string;
    gst?: string;
  };
  advanceAmount: number;
  advanceUsedAmount: number;
  remainingAdvanceAmount: number;
  products: IPerformaProductItem[];
  totalRequiredCases: number;
  totalUsedCases: number;
  totalRemainingCases: number;
  totalAllocatedAmount: number;
  totalUsedAmount: number;
  totalRemainingAmount: number;
  status: PerformaStatus;
  date: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PerformaProductItemSchema: Schema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  productSnapshot: {
    productCode: { type: String, trim: true, default: '' },
    productName: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
  },
  requiredCases: { type: Number, required: true, min: 0, default: 0 },
  usedCases: { type: Number, required: true, min: 0, default: 0 },
  remainingCases: { type: Number, required: true, min: 0, default: 0 },
  caseOut: { type: Number, required: true, min: 0, default: 0 },
  rate: { type: Number, required: true, min: 0, default: 0 },
  pktPerUnit: { type: Number, required: true, min: 0, default: 1 },
  allocatedAmount: { type: Number, required: true, min: 0, default: 0 },
  usedAmount: { type: Number, required: true, min: 0, default: 0 },
  remainingAmount: { type: Number, required: true, min: 0, default: 0 },
});

const PerformaSchema: Schema = new Schema(
  {
    performaNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    companyName: { type: String, trim: true, default: '' },
    customerSnapshot: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true, default: '' },
      companyName: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      gst: { type: String, trim: true, default: '' },
    },
    advanceAmount: { type: Number, required: true, min: 0, default: 0 },
    advanceUsedAmount: { type: Number, required: true, min: 0, default: 0 },
    remainingAdvanceAmount: { type: Number, required: true, min: 0, default: 0 },
    products: [PerformaProductItemSchema],
    totalRequiredCases: { type: Number, required: true, min: 0, default: 0 },
    totalUsedCases: { type: Number, required: true, min: 0, default: 0 },
    totalRemainingCases: { type: Number, required: true, min: 0, default: 0 },
    totalAllocatedAmount: { type: Number, required: true, min: 0, default: 0 },
    totalUsedAmount: { type: Number, required: true, min: 0, default: 0 },
    totalRemainingAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'PARTIALLY_USED', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    date: { type: String, required: true },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: 'Admin' },
  },
  { timestamps: true }
);

PerformaSchema.index({ customerId: 1, status: 1, date: 1 });
PerformaSchema.index({ 'customerSnapshot.name': 1 });
PerformaSchema.index({ createdAt: -1 });

export const Performa = mongoose.model<IPerforma>('Performa', PerformaSchema);
