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
import { useState } from "react";
import dayjs from "dayjs";

export const meta: MetaFunction = () => {
  return [
    { title: "FIRE Mana" },
    { name: "description", content: "Welcome to FIRE Mana!" },
  ];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || currentMonth();
  const start = dayjs(period).startOf('month').format('YYYY-MM-DD');
  const end = dayjs(period).endOf('month').format('YYYY-MM-DD');
  const linkToken = await plaidApi.getLinkToken();
  const items = await getLinkedItems('sandbox');
  const allAccounts = [];
  const allTransactions = [];
  for (const item of items) {
    const accounts = await plaidApi.getAccounts(item.accessToken);
    const transactions = await plaidApi.getTransactions(item.accessToken, start, end);
    allAccounts.push(...accounts);
    allTransactions.push(...transactions);
  }
  return { linkToken, allAccounts, allTransactions };
};

async function getLinkedItems(userId: string) {
  const client = createClient({ url: process.env.REDIS_URL });
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

function breakdownByCategory(transactions: plaidApi.Transaction[]) {
  return transactions.reduce((categories: { [key: string]: number }, transaction: plaidApi.Transaction) => {
    const category = transaction.category[0];
    categories[category] = (categories[category] || 0) - transaction.amount;
    return categories;
  }, {});
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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const period = data.period || currentMonth();
  const transactions = data.allTransactions.filter((transaction: plaidApi.Transaction) => {
    if (categoryFilter) {
      return transaction.category.includes(categoryFilter);
    }
    return true;
  });
  const netWorth = data.allAccounts.reduce((sum: number, account: plaidApi.Account) => {
    const balance = getBalance(account);
    return sum + balance;
  }, 0);
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h2 className="ribbon">
        Accounts
        <button onClick={() => open()} disabled={!ready}>Link a bank account</button>
      </h2>
      <ul className="account-list">
        <li className="net-worth">
          <div className="account-balance">
            <h3>
              <u>{formatCurrency(netWorth, 'USD')}</u>
            </h3>
            <i>Net Worth</i>
          </div>
        </li>
        {data.allAccounts.map((account: plaidApi.Account) => (
          <li key={account.account_id}>
            <AccountView account={account} />
          </li>
        ))}
      </ul>
      <h2 className="ribbon" id="transactions">
        Transactions 
        <form>
          <input type="month" name="period" defaultValue={period} />
          <button>Go</button>
        </form>
      </h2>
      <p>
        Showing transactions from {period} 
        {categoryFilter && <strong> for {categoryFilter}</strong>}
      </p>
      <p>Breakdown by category</p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>
              <a href="#transactions" onClick={() => setCategoryFilter(null)}>Clear</a>
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(breakdownByCategory(data.allTransactions)).map(([category, amount]) => (
            <tr key={category}>
              <td>{category}</td>
              <td>{formatCurrency(amount, 'USD')}</td>
              <td>
                <a href="#transactions" onClick={() => setCategoryFilter(category)}>Filter</a>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <th>{formatCurrency(data.allTransactions.reduce((sum: number, transaction: plaidApi.Transaction) => sum - transaction.amount, 0), 'USD')}</th>
          </tr>
        </tfoot>
      </table>
      <ul className="transaction-list">
        {transactions.map((transaction: plaidApi.Transaction) => (
          <li key={transaction.transaction_id}>
            <TransactionView transaction={transaction} />
            <details>
              <summary>Code</summary>
              <pre>{JSON.stringify(transaction, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const getBalance = (account: plaidApi.Account) => {
  return account.type === 'credit' ? -account.balances.current : account.balances.current;
}

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

const AccountView = ({ account }: { account: plaidApi.Account }) => {
  const balance = getBalance(account);
  if (balance === 0) return null;
  return (
    <div className="account-balance">
      <h3>{formatCurrency(balance, account.balances.iso_currency_code)}</h3>
      <span>{account.name} *{account.mask}</span>
      <details>
        <summary>Code</summary>
        <pre>{JSON.stringify(account, null, 2)}</pre>
      </details>
    </div>
  );
}

const TransactionView = ({ transaction }: { transaction: plaidApi.Transaction }) => {
  return (
    <div className="transaction">
      <h3 className="title">{transaction.name}</h3>
      <img className="logo" src={transaction.logo_url} />
      <span className="category">{transaction.category.join(', ')}</span>
      <h3 className="amount">{formatCurrency(-transaction.amount, transaction.iso_currency_code)}</h3>
      <span className="date">{transaction.date}</span>
    </div>
  );
}