import { Transaction } from "~/components/transactionView";
import { LinkedItem } from "./linkedItemService";

export type PlaidAccountResponse = {
  account_id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
  balances: Balance;
};

type PlaidAccountItem = {
  available_products: string[];
  billed_products: string[];
  error: any;
  institution_id: string;
  item_id: string;
  webhook: string;
};

export type Balance = {
  available: number;
  current: number;
  iso_currency_code: string;
  limit: number;
  unofficial_currency_code: string;
};

export type PlaidTransaction = {
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

type PlaidInstituion = {
  country_codes: string[];
  credentials: any;
  has_mfa: boolean;
  institution_id: string;
  mfa: string[];
  name: string;
  products: string[];
  routing_numbers: string[];
  status: string;
  url: string;
  logo: string;
};

export type ManderAccount = {
  account_id: string;
  instituionName: string;
  institutionLogo: string;
  name: string;
  type: string;
  mask: string;
  balances: Balance;
  itemId: string;
}

export async function getLinkToken(userId: string, accessToken?: string) : Promise<string> {
  // Get the Plaid Link token
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/link/token/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      client_name: 'Mander',
      country_codes: ['US'],
      language: 'en',
      user: {
        client_user_id: userId,
      },
      products: !accessToken && ['transactions'],
      optional_products: !accessToken && ['liabilities', 'investments'],
      access_token: accessToken,
    }),
  });

  const json = await response.json();
  if (response.status !== 200) {
    console.error(json, { plaidEnv: process.env.PLAID_ENV, plaidClientId: process.env.PLAID_CLIENT_ID });
    throw new Error('Unable to get link token, make sure you are using a valid Plaid client ID and secret');
  }

  return json.link_token;
}

export async function getAccounts(item: LinkedItem) : Promise<ManderAccount[]> {
  const response = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/accounts/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_CLIENT_SECRET,
      access_token: item.accessToken,
    }),
  });

  const json = await response.json();

  if (response.status !== 200 && json.error_code !== 'ITEM_LOGIN_REQUIRED') {
    console.error(json);
    return [
      {
        account_id: 'fake-account-id',
        instituionName: 'Fake Bank',
        institutionLogo: 'https://cdn.pixabay.com/photo/2012/04/02/13/17/bank-24894_960_720.png',
        name: 'Fake Account',
        type: 'fake',
        mask: '1234',
        balances: {
          available: 1000,
          current: 1000,
          iso_currency_code: 'USD',
          limit: 0,
          unofficial_currency_code: '',
        },
        itemId: item.itemId,
      }
    ]
  }

  const accounts = json.accounts || [];
  const accountItem: PlaidAccountItem = json.item || {};
  let institution: PlaidInstituion;

  try {
    const institutionResponse = await fetch(`https://${process.env.PLAID_ENV}.plaid.com/institutions/get_by_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_CLIENT_SECRET,
        institution_id: accountItem.institution_id,
        country_codes: ['US'],
        options: {
          include_optional_metadata: true,
        },
      }),
    });

    const institutionJson = await institutionResponse.json();
    institution = institutionJson.institution || {};
  }
  catch (err) {
    console.error('Unable to get institution info', err);
  }

  return accounts.map((a: PlaidAccountResponse) => ({
    account_id: a.account_id,
    instituionName: institution.name,
    institutionLogo: institution.logo,
    name: a.name,
    type: a.type,
    mask: a.mask,
    balances: a.balances,
    itemId: item.itemId,
  }));
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
      options: {
        count: 500,
        days_requested: 730,
      }
    }),
  });

  const json = await response.json();
  const transactions = json.transactions || [];
  return transactions.map((t: PlaidTransaction) => ({
    name: t.name,
    amount: t.amount,
    date: t.date,
    category: t.category,
    id: t.transaction_id,
    logo: t.logo_url,
    canDelete: false,
  }));
}
