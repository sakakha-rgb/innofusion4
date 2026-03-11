import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  const { license_key, hardware_id } = req.body;
  
  if (!license_key || !hardware_id) {
    return res.status(400).json({ valid: false, error: 'Missing fields' });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('innofusion');
    const license = await db.collection('licenses').findOne({ key: license_key });

    const now = new Date();
    
    // Check validity
    const isValid = license &&
      now < new Date(license.expiresAt) &&
      license.activations?.some(a => a.hardwareId === hardware_id);

    // Update last check-in if valid
    if (isValid) {
      await db.collection('licenses').updateOne(
        { key: license_key, 'activations.hardwareId': hardware_id },
        { $set: { 'activations.$.lastCheckIn': now } }
      );
    }

    res.json({
      valid: isValid,
      tier: isValid ? license.tier : null,
      features: isValid ? license.features : null,
      expires_at: isValid ? license.expiresAt : null,
      checked_at: now.toISOString()
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ valid: false, error: 'Server error' });
  } finally {
    await client.close();
  }
}