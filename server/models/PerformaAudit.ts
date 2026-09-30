import mongoose, { Schema, Document } from 'mongoose';

export type PerformaAuditType =
  | 'ADVANCE_RECEIVED'
  | 'PERFORMA_ADVANCE'
  | 'PERFORMA_CONSUMED'
  | 'PERFORMA_REVERSED'
  | 'PERFORMA_CANCELLED';

export interface IPerformaAudit extends Document {
  customerId: mongoose.Types.ObjectId | string;
  customerName: string;
  performaId?: mongoose.Types.ObjectId | string;
  performaNumber?: string;
  particularId?: mongoose.Types.ObjectId | string;
  billNo?: string;
  productId?: mongoose.Types.ObjectId | string;
  productName?: string;
  cases?: number;
  amount: number;
  type: PerformaAuditType;
  date: string;
  paymentMode?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PerformaAuditSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    performaId: { type: Schema.Types.ObjectId, ref: 'Performa', index: true },
    performaNumber: { type: String, trim: true },
    particularId: { type: Schema.Types.ObjectId, ref: 'Particular', index: true },
    billNo: { type: String, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true },
    cases: { type: Number, default: 0 },
    amount: { type: Number, required: true, default: 0 },
    type: {
      type: String,
      enum: ['ADVANCE_RECEIVED', 'PERFORMA_ADVANCE', 'PERFORMA_CONSUMED', 'PERFORMA_REVERSED', 'PERFORMA_CANCELLED'],
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    paymentMode: { type: String, trim: true, default: 'Bank' },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: 'Admin' },
  },
  { timestamps: true }
);

PerformaAuditSchema.index({ customerId: 1, type: 1, date: 1 });
PerformaAuditSchema.index({ particularId: 1, type: 1 });

export const PerformaAudit = mongoose.model<IPerformaAudit>('PerformaAudit', PerformaAuditSchema);
