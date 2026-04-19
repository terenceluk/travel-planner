import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import directionsRouter from './routes/directions';
import autocompleteRouter from './routes/autocomplete';
import placeImageRouter from './routes/place-image';
import configRouter from './routes/config';
import validateKeyRouter from './routes/validate-key';
import geocodeRouter from './routes/geocode';
import optimizeOrderRouter from './routes/optimize-order';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/config', configRouter);
app.use('/api/validate-key', validateKeyRouter);
app.use('/api/directions', directionsRouter);
app.use('/api/autocomplete', autocompleteRouter);
app.use('/api/place-image', placeImageRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/optimize-order', optimizeOrderRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (_, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
