import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { fetchAllCaseData } from '../services/listClaimDecisions.service';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/api/case-history', async (req, res) => {
  try {
    const { irn } = z.object({ irn: z.string() }).parse({ irn: req.query.irn });
    const irnNum = Number(irn);
    if (!Number.isInteger(irnNum) || irnNum <= 0) {
      return res.status(400).json({ error: 'Invalid IRN' });
    }
    const payload = await fetchAllCaseData(supabase, irnNum);
    res.json(payload);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Bad request' });
  }
});

export default router;
