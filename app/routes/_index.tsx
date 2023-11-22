import { type MetaFunction, type LoaderFunction, redirect, LinksFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from 'react-plaid-link';
import { createClient } from "../lib/redis.server";
import * as plaidApi from "services/plaidApiClient";
import styles from '~/styles/_index.css';

export const meta: MetaFunction = () => {
  return [
    { title: "FIRE Mana" },
    { name: "description", content: "Welcome to FIRE Mana!" },
  ];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
}

export const loader: LoaderFunction = async () => {
  const linkToken = await plaidApi.getLinkToken();
  const items = await getLinkedItems('sandbox');
  const allAccounts = [];
  const allTransactions = [];
  for (const item of items) {
    const accounts = await plaidApi.getAccounts(item.accessToken);
    const transactions = await plaidApi.getTransactions(item.accessToken, '2023-09-18', '2023-11-18');
    allAccounts.push(...accounts);
    allTransactions.push(...transactions);
  }
  return { linkToken, allAccounts, allTransactions };
};

async function getLinkedItems(userId: string) {
  const client = createClient({ url: 'redis://localhost:6381' });
  await client.connect();
  const itemIds = await client.sMembers(`user:${userId}:items`);
  const items = [];
  for (const itemId of itemIds) {
    const item = await client.hGetAll(`user:${userId}:${itemId}`);
    items.push(item);
  }
  client.quit();
  return items;
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const config: PlaidLinkOptions = {
    onSuccess: (public_token, metadata) => {
      window.location.href = `/complete-link-account?public_token=${public_token}`;
    },
    token: data.linkToken,
  };
  const { open, ready } = usePlaidLink(config);
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h2 className="ribbon">
        Accounts
        <button onClick={() => open()} disabled={!ready}>Link a bank account</button>
      </h2>
      <ul className="account-list">
        {data.allAccounts.map((account: plaidApi.Account) => (
          <li key={account.account_id}>
            <AccountView account={account} />
            <details>
              <summary>Code</summary>
              <pre>{JSON.stringify(account, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
      <h2 className="ribbon">Transactions</h2>
      <ul className="transaction-list">
        {data.allTransactions.map((transaction: plaidApi.Transaction) => (
          <li key={transaction.transaction_id}>
            <TransactionView transaction={transaction} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const AccountView = ({ account }: { account: plaidApi.Account }) => {
  return (
    <div className="account-balance">
      <h3>{formatCurrency(account.balances.available, account.balances.iso_currency_code)}</h3>
      <span>{account.name} *{account.mask}</span>
    </div>
  );
}

const TransactionView = ({ transaction }: { transaction: plaidApi.Transaction }) => {
  return (
    <div className="transaction">
      <h3 className="title">{transaction.name}</h3>
      <img className="logo" src={transaction.logo_url} />
      <span className="category">{transaction.category.join(', ')}</span>
      <h3 className="amount">{formatCurrency(transaction.amount, transaction.iso_currency_code)}</h3>
      <span className="date">{transaction.date}</span>
    </div>
  );
}