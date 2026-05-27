// routes/chatClaimStatus.ts
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { fetchAllCaseData } from '../services/listClaimDecisions.service';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const bodySchema = z.object({
  crn: z.string().optional(),          // DisplayIRN
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type Match = { irn: number; displayIRN: string | null; workerFirst?: string; workerLast?: string; incidentType?: string | null };

router.post('/api/chat/claim-status', async (req, res) => {
  try {
    const { crn, firstName, lastName } = bodySchema.parse(req.body);
    if (!crn && !firstName && !lastName) {
      return res.status(400).json({ error: 'Provide CRN or First & Last name.' });
    }

    const matches: Match[] = [];
    const seen = new Set<number>();

    // 1) Prefer CRN (DisplayIRN) exact or ilike
    if (crn) {
      const { data, error } = await supabase
        .from('form1112master')
        .select('IRN, DisplayIRN, IncidentType, WorkerID')
        .ilike('DisplayIRN', crn);
      if (error) throw error;

      const workerIds = Array.from(new Set((data || []).map(r => r.WorkerID)));
      let names: Record<string, { first: string; last: string }> = {};
      if (workerIds.length) {
        const { data: w } = await supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName')
          .in('WorkerID', workerIds);
        w?.forEach(row => { names[row.WorkerID] = { first: row.WorkerFirstName, last: row.WorkerLastName }; });
      }

      (data || []).forEach(r => {
        if (!seen.has(r.IRN)) {
          seen.add(r.IRN);
          const nm = names[r.WorkerID] || {};
          matches.push({ irn: r.IRN, displayIRN: r.DisplayIRN ?? null, workerFirst: nm.first, workerLast: nm.last, incidentType: r.IncidentType ?? null });
        }
      });
    }

    // 2) If no CRN or no hits, fall back to First/Last name search
    if ((!crn || matches.length === 0) && (firstName || lastName)) {
      // find workers by name
      let wq = supabase.from('workerpersonaldetails').select('WorkerID, WorkerFirstName, WorkerLastName');
      if (firstName) wq = wq.ilike('WorkerFirstName', `%${firstName}%`);
      if (lastName)  wq = wq.ilike('WorkerLastName', `%${lastName}%`);
      const { data: workers, error: we } = await wq;
      if (we) throw we;

      const workerIds = (workers || []).map(w => w.WorkerID);
      if (workerIds.length) {
        const { data: forms, error: fe } = await supabase
          .from('form1112master')
          .select('IRN, DisplayIRN, IncidentType, WorkerID')
          .in('WorkerID', workerIds);
        if (fe) throw fe;

        (forms || []).forEach(r => {
          if (!seen.has(r.IRN)) {
            seen.add(r.IRN);
            const nm = workers?.find(w => w.WorkerID === r.WorkerID);
            matches.push({
              irn: r.IRN,
              displayIRN: r.DisplayIRN ?? null,
              workerFirst: nm?.WorkerFirstName,
              workerLast: nm?.WorkerLastName,
              incidentType: r.IncidentType ?? null
            });
          }
        });
      }
    }

    if (matches.length === 0) {
      return res.status(404).json({ error: 'No matching claim found. Please confirm your CRN or name.' });
    }

    // If more than one IRN matched, ask the bot to prompt the user to choose
    if (matches.length > 1) {
      // Keep it short & claimant-friendly
      return res.json({
        needsDisambiguation: true,
        options: matches.map(m => ({
          irn: m.irn,
          label: `${m.displayIRN ?? `IRN ${m.irn}`} — ${m.workerFirst ?? ''} ${m.workerLast ?? ''} ${m.incidentType ? `(${m.incidentType})` : ''}`.trim()
        }))
      });
    }

    // Single match → fetch the full status
    const irn = matches[0].irn;
    const payload = await fetchAllCaseData(supabase, irn);
    return res.json({ irn, displayIRN: matches[0].displayIRN, ...payload });

  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Failed to fetch claim status' });
  }
});

export default router;
