/**
 * CLI: Import Credit Card billers from Excel/CSV into DB.
 * Run from backend folder. Use on VPS when the dropdown is empty (DB has no billers).
 *
 *   npm run import-billers -- path/to/Bharat Connect_biller-info.xlsx
 */
require('dotenv').config();
import * as fs from 'fs';
import * as path from 'path';
import { bbpsService } from '../services/bbps.service';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npm run import-billers -- <path-to-xlsx-or-csv>');
  console.error('Example: npm run import-billers -- "./Bharat Connect_biller-info.xlsx"');
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), filePath);
if (!fs.existsSync(resolved)) {
  console.error('File not found:', resolved);
  process.exit(1);
}

const buffer = fs.readFileSync(resolved);
const filename = path.basename(resolved);

bbpsService
  .importBillersFromFile(buffer, filename)
  .then((r) => {
    console.log('Imported:', r.imported, 'Credit Card biller(s). Skipped:', r.skipped, 'row(s).');
    if (r.errors.length) console.warn('Warnings:', r.errors.slice(0, 10).join('; '));
    process.exit(0);
  })
  .catch((e: any) => {
    console.error('Import failed:', e?.message || e);
    process.exit(1);
  });
