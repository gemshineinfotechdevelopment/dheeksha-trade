import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  slNo: number;
  name: string;
  code?: string;
  category?: string;
  rate?: number;
  pktUnit?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    slNo: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    rate: { type: Number, default: 0 },
    pktUnit: { type: String, trim: true, default: '1' },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
