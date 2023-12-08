import { LoaderFunction, json, redirect } from "@remix-run/node";
import { createClient } from "redis";
import { authenticator } from "~/auth.server";

async function exchangeToken(publicToken: string) {
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/item/public_token/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      public_token: publicToken,
    }),
  });

  const exchangeBody = await response.json();
  return exchangeBody;
}

async function saveAccessToken(userId: string, itemId: string, accessToken: string) {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  await client.hSet(`user:${userId}:${itemId}`, {
    userId,
    itemId,
    accessToken,
  });
  await client.sAdd(`user:${userId}:items`, itemId);
  client.quit();
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect('/login');
  }
  const url = new URL(request.url);
  const publicToken = url.searchParams.get('public_token');
  if (!publicToken) {
    return json({ error: 'No public token' }, { status: 400 });
  }

  // Exchange the public token for an access token
  const exchange = await exchangeToken(publicToken);
  console.log('exchange', exchange);

  // Save the access token
  await saveAccessToken(user.userId, exchange.item_id, exchange.access_token);

  // Redirect to the Plaid Link API with the token
  return redirect(`/`);
};