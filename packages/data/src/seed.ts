import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
import { sampleInit } from '../../contracts/src/fixtures';
import { ensureAtlasCollections, helperDocument, householdDocument } from './index';

export async function seed(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) throw new Error('MONGODB_URI is required for Atlas seed');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await ensureAtlasCollections(client);
    const db = client.db(process.env.MONGODB_DB || 'lastmile');
    await db.collection('households').bulkWrite(sampleInit.households.map((household) => ({ updateOne: {
      filter: { scenarioId: sampleInit.scenarioId, id: household.id },
      update: { $set: householdDocument(sampleInit.scenarioId, household) }, upsert: true,
    } })));
    await db.collection('helpers').bulkWrite(sampleInit.helpers.map((helper) => ({ updateOne: {
      filter: { scenarioId: sampleInit.scenarioId, id: helper.id },
      update: { $set: helperDocument(sampleInit.scenarioId, helper) }, upsert: true,
    } })));
    await db.collection('scenarios').updateOne({ scenarioId: sampleInit.scenarioId },
      { $set: { scenarioId: sampleInit.scenarioId, config: sampleInit.config, assumptions: sampleInit.assumptions } }, { upsert: true });
  } finally { await client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().then(() => console.log('Atlas seed complete')).catch((error) => { console.error(error); process.exitCode = 1; });
}
