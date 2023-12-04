export type Account = {
  account_id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
  balances: Balance;
};

export type Balance = {
  available: number;
  current: number;
  iso_currency_code: string;
  limit: number;
  unofficial_currency_code: string;
};

export type Transaction = {
  account_id: string;
  account_owner: string;
  amount: number;
  authorized_date: string;
  category: string[];
  category_id: string;
  date: string;
  iso_currency_code: string;
  location: Location;
  name: string;
  payment_channel: string;
  payment_meta: PaymentMeta;
  pending: boolean;
  pending_transaction_id: string;
  transaction_id: string;
  transaction_type: string;
  unofficial_currency_code: string;
  logo_url: string;
};

export type PaymentMeta = {
  by_order_of: string;
  payee: string;
  payer: string;
  payment_method: string;
  payment_processor: string;
  ppd_id: string;
  reason: string;
  reference_number: string;
};

export async function getLinkToken() : Promise<string> {
  // Get the Plaid Link token
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/link/token/create`, {
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
    }),
  });

  const json = await response.json();
  if (response.status !== 200) {
    console.error(json, { plaidEnv: process.env.PLAID_ENV, plaidClientId: process.env.PLAID_CLIENT_ID });
    throw new Error('Unable to get link token, make sure you are using a valid Plaid client ID and secret');
  }

  return json.link_token;
}

export async function getAccounts(accessToken: string) : Promise<Account[]> {
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/accounts/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      access_token: accessToken,
    }),
  });

  const json = await response.json();
  return json.accounts || [];
}

export async function getTransactions(accessToken: string, startDate: string, endDate: string) : Promise<Transaction[]> {
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/transactions/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const json = await response.json();

  return json.transactions || [];
}
