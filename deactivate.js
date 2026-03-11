import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { license_key, hardware_id, secret } = req.body;

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');

    let result;

    if (secret === process.env.ADMIN_SECRET) {
      // Admin can deactivate any device
      result = await licenses.updateOne(
        { key: license_key },
        { $pull: { activations: { hardwareId: hardware_id } } }
      );
    } else {
      // User can only deactivate their own device
      result = await licenses.updateOne(
        { key: license_key, 'activations.hardwareId': hardware_id },
        { $pull: { activations: { hardwareId: hardware_id } } }
      );
    }

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device deactivated' });

  } catch (error) {
    console.error('Deactivation error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
}