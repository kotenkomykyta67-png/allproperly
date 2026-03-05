import * as functions from 'firebase-functions';
import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { getAttomApiKey } from './attomApiUtil';

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
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.post('/getRentRenewalSuggestion', async (req: Request, res: Response) => {
  // Hardcoded test address for ATTOM API
  const address = '5266 N Blue Ash Pl';
  const city = 'Boise';
  const state = 'ID';
  const postalcode = '83703';
  try {
    // Get API key from secret manager
    const ATTOM_API_KEY = await getAttomApiKey(ATTOM_SECRET_NAME);
    console.log('[DEBUG] ATTOM_API_KEY:', ATTOM_API_KEY ? ATTOM_API_KEY.slice(0, 6) + '...' : 'undefined');
    // Use separate query parameters as required by ATTOM API
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/valuation/rentalavm?address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&postalcode=${encodeURIComponent(postalcode)}`;
    console.log('[DEBUG] Request URL:', url);
    const response = await axios.get(url, {
      headers: {
        apikey: ATTOM_API_KEY,
        Accept: 'application/json',
      },
    });
    const suggestion = response.data?.rentalAVM?.rentRangeLow || null;
    if (!suggestion) {
      return res.status(404).json({ error: 'No rent suggestion found' });
    }
    return res.json({ suggestion });
  } catch (error: any) {
    console.error('❌ ATTOM API error:', error?.response?.data || error);
    return res.status(500).json({
      error: error?.response?.data || error.message || 'Failed to fetch rent suggestion'
    });
  }
});

export const getRentRenewalSuggestionHttp = functions.https.onRequest(app);
