// routes/chatClaimStatusByIrn.ts
import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { fetchAllCaseData } from '../services/listClaimDecisions.service';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/api/chat/claim-status/by-irn', async (req, res) => {
  try {
    const { irn } = z.object({ irn: z.number().int().positive() }).parse(req.body);
    const payload = await fetchAllCaseData(supabase, irn);
    res.json(payload);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Invalid IRN' });
  }
});

export default router;
