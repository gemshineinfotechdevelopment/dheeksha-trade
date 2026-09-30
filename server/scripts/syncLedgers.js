const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function sync() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const performas = await mongoose.connection.db.collection('performas').find().toArray();
  const ledgersCol = mongoose.connection.db.collection('accountledgers');

  for (const p of performas) {
    const adv = parseFloat(p.advanceAmount) || 0;
    if (adv <= 0) continue;

    const custName = p.customerSnapshot?.name;
    if (!custName) continue;

    // Check if an ADVANCE ledger entry or linked credit ledger entry exists for this performa
    const existing = await ledgersCol.findOne({
      $or: [
        { performaNumber: p.performaNumber },
        { performaId: String(p._id) },
        { reference: p.performaNumber },
        { billNo: p.performaNumber }
      ]
    });

    console.log(`Performa ${p.performaNumber} (${custName}): Advance = ${adv}, Linked Ledger =`, existing ? existing._id : 'NONE');

    if (!existing) {
      // Format date as DD-MM-YYYY
      let formattedDate = p.date || '';
      if (formattedDate.includes('-') && formattedDate.split('-')[0].length === 4) {
        const parts = formattedDate.split('-');
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else if (!formattedDate) {
        const d = new Date();
        formattedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      }

      const newLedger = {
        billNo: p.performaNumber,
        performaId: String(p._id),
        performaNumber: p.performaNumber,
        customerName: custName,
        companyName: p.companyName || p.customerSnapshot?.companyName || 'General',
        date: formattedDate,
        debit: '0.00',
        credit: adv.toFixed(2),
        balance: '0.00',
        paymentMode: 'Bank',
        reference: p.performaNumber,
        notes: `Initial Advance for Performa ${p.performaNumber}`,
        type: 'ADVANCE',
        createdAt: p.createdAt || new Date(),
        updatedAt: new Date()
      };

      await ledgersCol.insertOne(newLedger);
      console.log(`Created missing ledger entry for Performa ${p.performaNumber}`);
    }
  }

  // Recalculate balances for all customers
  const customers = await mongoose.connection.db.collection('customers').find().toArray();
  for (const c of customers) {
    const entries = await ledgersCol.find({
      customerName: { $regex: new RegExp(`^${c.name.trim()}$`, 'i') }
    }).sort({ createdAt: 1, _id: 1 }).toArray();

    let currentBalance = 0;
    for (const entry of entries) {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      currentBalance = currentBalance + cred - deb;
      await ledgersCol.updateOne({ _id: entry._id }, { $set: { balance: currentBalance.toFixed(2) } });
    }
    console.log(`Updated customer ${c.name} running ledger balance: ₹${currentBalance.toFixed(2)}`);
  }

  process.exit(0);
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
