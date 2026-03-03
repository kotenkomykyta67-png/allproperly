import * as functions from 'firebase-functions';
import express, { Request, Response, NextFunction } from 'express';
import { getAttomPropertyDetails } from './attomApiUtil';

const ATTOM_SECRET_NAME = 'projects/650294800122/secrets/ATTOM_API_KEY/versions/latest';
const allowedOrigins = ["http://localhost:5173", "https://app.allproperly.com", "https://allproperly.com"];


const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight immediately
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.post('/getAttomPropertyDetails', async (req: Request, res: Response) => {
  const { address, city, state, zip } = req.body;
  // Basic validation for required fields
  if (!address || !city || !state || !zip) {
    return res.status(400).json({ error: 'Full address info is required' });
  }
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'ZIP code must be 5 digits' });
  }
  try {
    const fullAddress = `${address}, ${city}, ${state} ${zip}`;
    const propertyDetails = await getAttomPropertyDetails({ fullAddress }, ATTOM_SECRET_NAME);
    if (!propertyDetails || Object.keys(propertyDetails).length === 0) {
      return res.status(404).json({ error: 'No property found' });
    }
    return res.json(propertyDetails);
  } catch (error: any) {
    // Surface ATTOM's error response to frontend
    console.error('❌ ATTOM API error:', error?.response?.data || error);
    return res.status(500).json({
      error: error?.response?.data || error.message || 'Failed to fetch property details'
    });
  }
});

export const getAttomPropertyDetailsHttp = functions.https.onRequest(app);
