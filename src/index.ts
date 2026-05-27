import express from 'express';
import cors from 'cors';
import caseHistory from './routes/caseHistory';
import chatClaimStatus from './routes/chatClaimStatus';          // from earlier step
import chatClaimStatusByIrn from './routes/chatClaimStatusByIrn';// optional

const app = express();
app.use(cors());
app.use(express.json());

app.use(caseHistory);
app.use(chatClaimStatus);
app.use(chatClaimStatusByIrn);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
