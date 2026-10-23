/**
 * One-time fix script: Reset inflated advanceAmount in Performas
 *
 * BUG: addCustomerCreditToMasterPerforma() was incorrectly adding credits
 * directly to masterPerforma.advanceAmount, which caused performa prints to
 * show a higher "Customer Advance" than the original booking value.
 *
 * This script:
 * 1. Finds each Performa
 * 2. Looks up all ADVANCE_RECEIVED audits for it
 * 3. Takes the FIRST audit amount as the true original advance
 * 4. Resets advanceAmount to that original value (does NOT change remainingAdvanceAmount)
 *
 * Run with: node server/scripts/fixInflatedAdvanceAmount.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set in .env');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Performa = mongoose.model(
    'Performa',
    new mongoose.Schema({
      performaNumber: String,
      advanceAmount: Number,
      remainingAdvanceAmount: Number,
      customerSnapshot: { name: String },
    }, { strict: false })
  );

  const PerformaAudit = mongoose.model(
    'PerformaAudit',
    new mongoose.Schema({
      performaId: mongoose.Schema.Types.ObjectId,
      type: String,
      amount: Number,
      createdAt: Date,
    }, { strict: false })
  );

  const performas = await Performa.find({});
  console.log(`Found ${performas.length} performas to check`);

  let fixed = 0;
  let skipped = 0;

  for (const perf of performas) {
    // Find all ADVANCE_RECEIVED audits for this performa, oldest first
    const audits = await PerformaAudit.find({
      performaId: perf._id,
      type: 'ADVANCE_RECEIVED',
    }).sort({ createdAt: 1 });

    if (audits.length === 0) {
      // No audits, can't determine original advance — skip
      skipped++;
      continue;
    }

    // The first audit is the original performa advance
    const originalAdvance = Number(audits[0].amount) || 0;

    if (perf.advanceAmount === originalAdvance) {
      // Already correct
      skipped++;
      continue;
    }

    const oldVal = perf.advanceAmount;
    console.log(
      `  Fixing ${perf.performaNumber} (${perf.customerSnapshot?.name}): ` +
      `advanceAmount ${oldVal} -> ${originalAdvance} (remainingAdvanceAmount stays ${perf.remainingAdvanceAmount})`
    );

    await Performa.updateOne(
      { _id: perf._id },
      { $set: { advanceAmount: originalAdvance } }
    );
    fixed++;
  }

  console.log(`\nDone. Fixed: ${fixed} | Skipped (already correct / no audits): ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
