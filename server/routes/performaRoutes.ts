import { Router } from 'express';
import {
  getPerformas,
  getNextPerformaNumber,
  getPerformaById,
  createPerforma,
  updatePerforma,
  cancelPerforma,
  deletePerforma,
  addCustomerAdvance,
  getCustomerSummaryEndpoint,
  getCustomerAuditHistory,
} from '../controllers/performaController';

const router = Router();

router.get('/next-number', getNextPerformaNumber);
router.post('/advance', addCustomerAdvance);
router.get('/customer/:customerId/summary', getCustomerSummaryEndpoint);
router.get('/customer/:customerId/audit', getCustomerAuditHistory);
router.patch('/:id/cancel', cancelPerforma);

router.route('/')
  .get(getPerformas)
  .post(createPerforma);

router.route('/:id')
  .get(getPerformaById)
  .put(updatePerforma)
  .delete(deletePerforma);

export default router;
