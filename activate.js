import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { license_key, hardware_id, product, version } = req.body;
  
  // Validation
  if (!license_key || !hardware_id) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Validate license key format (XXXX-XXXX-XXXX-XXXX)
  const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!keyPattern.test(license_key)) {
    return res.status(400).json({ success: false, error: 'Invalid license key format' });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');

    const license = await licenses.findOne({ key: license_key });
    
    if (!license) {
      return res.status(400).json({ success: false, error: 'Invalid license key', code: 'INVALID_KEY' });
    }
    
    if (new Date() > new Date(license.expiresAt)) {
      return res.status(400).json({ 
        success: false, 
        error: 'License expired', 
        code: 'EXPIRED',
        expired_at: license.expiresAt 
      });
    }

    // Check if already activated on this device
    const existing = license.activations?.find(a => a.hardwareId === hardware_id);
    if (existing) {
      // Update last check-in
      await licenses.updateOne(
        { key: license_key, 'activations.hardwareId': hardware_id },
        { $set: { 'activations.$.lastCheckIn': new Date() } }
      );
      
      return res.json({ 
        success: true, 
        reactivated: true, 
        tier: license.tier,
        features: license.features,
        expires_at: license.expiresAt 
      });
    }

    // Check max activations
    const maxDevices = license.maxActivations || 2;
    if (license.activations?.length >= maxDevices) {
      return res.status(403).json({ 
        success: false, 
        error: 'Maximum devices reached. Please deactivate another device.',
        code: 'MAX_DEVICES'
      });
    }

    // Add new activation
    await licenses.updateOne(
      { key: license_key },
      { 
        $push: { 
          activations: { 
            hardwareId: hardware_id, 
            activatedAt: new Date(),
            lastCheckIn: new Date(),
            product: product || 'unknown',
            version: version || 'unknown'
          } 
        },
        $set: { activated: true }
      }
    );

    res.json({ 
      success: true, 
      tier: license.tier,
      features: license.features,
      expires_at: license.expiresAt,
      max_devices: maxDevices,
      device_count: (license.activations?.length || 0) + 1
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ success: false, error: 'Server error', code: 'SERVER_ERROR' });
  } finally {
    await client.close();
  }
}