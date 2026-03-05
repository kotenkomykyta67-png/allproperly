// @ts-ignore
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import axios from 'axios';

const client = new SecretManagerServiceClient();

export async function getAttomApiKey(secretName: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: secretName,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error('No secret payload found');
  return payload;
}


export interface AttomAddress {
  fullAddress: string;
}

export interface AttomPropertyFields {
  yearBuilt?: number;
  squareFeet?: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  estimatedValue?: number;
}

export async function getAttomPropertyDetails(

  addressInfo: AttomAddress & { street?: string; city?: string; state?: string; zip?: string },
  secretName: string
): Promise<AttomPropertyFields> {
  try {
    const apiKey = await getAttomApiKey(secretName);

    // Helper to make request and log mode
    const tryRequest = async (url: string, mode: string) => {
      console.log(`[ATTOM][DEBUG][${mode}] Using API Key:`, apiKey ? apiKey.slice(0, 6) + '...' : 'undefined');
      console.log(`[ATTOM][DEBUG][${mode}] Request URL:`, url);
      console.log(`[ATTOM][DEBUG][${mode}] Request Address Info:`, addressInfo);
      const response = await axios.get(url, {
        headers: {
          apikey: apiKey,
          Accept: 'application/json',
        },
      });
      if (response.data?.property?.length) {
        console.log(`[ATTOM][${mode}] Success`, response.data.property[0]);
        return response.data.property[0];
      }
      return null;
    };

    // Step 1: Try structured fields if available
    let property = null;
    if (addressInfo.street && addressInfo.city && addressInfo.state && addressInfo.zip) {
      const structuredUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address1=${encodeURIComponent(addressInfo.street)}&city=${encodeURIComponent(addressInfo.city)}&state=${encodeURIComponent(addressInfo.state)}&postalcode=${encodeURIComponent(addressInfo.zip)}`;
      property = await tryRequest(structuredUrl, 'STRUCTURED');
    }

    // Step 2: Fallback to full address if nothing found
    if (!property && addressInfo.fullAddress) {
      const fallbackUrl = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile?address=${encodeURIComponent(addressInfo.fullAddress)}`;
      property = await tryRequest(fallbackUrl, 'FALLBACK');
    }

    if (!property) {
      console.error('[ATTOM][ERROR] No property found for given address');
      throw new Error('No property found for given address');
    }
    return property;
  } catch (error: any) {
    console.error('[ATTOM][ERROR]', error);
    throw error;
  }
}
