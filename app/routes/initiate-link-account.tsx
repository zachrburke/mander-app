
import { LoaderFunction, redirect } from '@remix-run/node';

async function getPlaidLinkToken() {
  // Get the Plaid Link token
  const response = await fetch('https://sandbox.plaid.com/link/token/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      client_name: 'FIRE Mana',
      country_codes: ['US'],
      language: 'en',
      user: {
        client_user_id: '1',
      },
      products: ['auth'],
      onSuccess: 'https://localhost:3000/complete-link-account',
    }),
  });

  const json = await response.json();

  return json.link_token;
}

export const loader: LoaderFunction = async ({ request }) => {
  // Get the Plaid Link token
  const linkToken = await getPlaidLinkToken();
  console.log('linkToken', linkToken);

  // Redirect to the Plaid Link API with the token
  return redirect(`https://cdn.plaid.com/link/v2/stable/link.html?key=${process.env.PLAID_PUBLIC_KEY}&token=${linkToken}&env=${process.env.PLAID_ENV}&product=auth`);
};

export default function LinkAccount() {
  return null;
}
