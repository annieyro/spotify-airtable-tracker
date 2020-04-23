import cors from 'cors';
import dotenv from 'dotenv-safe';
import express from 'express';
import { createUser } from './lib/airtable/request';
import { synchDevProd } from './utils/synchDevProd';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Allow Cross-Origin Requests
app.use(express.json()); // Format post body using JSON

// GET route as a sanity check when deploying
app.get('/', (_, res) => {
  res.send(
    "You've reached the Spotify Airtable Tracker backend server. Try sending a request to one of the API endpoints!"
  );
});

// POST route to create a user in Airtable
app.post('/create-user', async (req, res) => {
  console.log('Received Invite Request with body:');
  console.log(req.body);
  await createUser(req.body);
});

// Example code from DC Central Kitchen
// GET route to trigger synch from dev to prod
app.get('/synch', async (_, res) => {
  try {
    const {
      newIds,
      updatedProductNames,
      updatedProductIds,
      updatedStoreNames,
      updatedStoreIds,
    } = await synchDevProd();
    res.send({
      newIds,
      updatedProductNames,
      updatedProductIds,
      updatedStoreNames,
      updatedStoreIds,
    });
  } catch (e) {
    console.error(e);
  }
});

// Examples of People Power's API routes
app.post('/invite', async (req, res) => {
  console.log('Received Invite Request with body:');
  console.log(req.body);

  // const confirmSend =  await sendInviteEmail(req.body.pledgeInviteId);
  const confirmSend = 'dummy';

  if (confirmSend === '') {
    res.send({
      status: `An error occured when sending an invitation.`,
    });
  }

  res.send({
    status: `Successfully sent an invitation to ${confirmSend}`,
  });
});

app.get('/approve', async (req, res) => {
  console.log('Received Approve Request with query:');
  console.log(req.query);

  const billId = req.query.id;
  try {
    // await approveSubscriberBill(billId);
    res.send('Subscriber Bill Approved!');
  } catch (e) {
    console.log(e);
    console.log('Request Approval Failed.');
    res
      .status(400)
      .send(
        'Request Approval Failed, likely due to malformed request or nonexistent subscriber ID.'
      );
  }
});

app.listen(port, () =>
  console.log(`Spotify Airtable Tracker listening on port ${port}!`)
);
