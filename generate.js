import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const ADMIN_SECRET = process.env.ADMIN_SECRET; // Set this in Vercel env

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, count = 1, tier = 'pro', days = 365, features = [], maxActivations = 2 } = req.body;

  // Admin authentication
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');

    const generated = [];
    
    for (let i = 0; i < count; i++) {
      const key = generateLicenseKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const license = {
        key,
        tier,
        features: features.length ? features : getDefaultFeatures(tier),
        maxActivations,
        activations: [],
        activated: false,
        createdAt: new Date(),
        expiresAt,
        createdBy: 'admin'
      };

      await licenses.insertOne(license);
      generated.push(key);
    }

    res.json({ 
      success: true, 
      generated,
      count: generated.length,
      tier,
      expires_in_days: days
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
}

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let key = '';
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) key += '-';
  }
  
  return key;
}

function getDefaultFeatures(tier) {
  const features = {
    basic: ['preview', 'import'],
    pro: ['preview', 'import', 'favorites', 'custom_categories'],
    enterprise: ['preview', 'import', 'favorites', 'custom_categories', 'team_sharing', 'api_access']
  };
  return features[tier] || features.basic;
}