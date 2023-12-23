import { type MetaFunction, type LoaderFunction, redirect, LinksFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from 'react-plaid-link';
import { createClient } from "../../redis.server";
import * as plaidApi from "~/services/plaidApiClient";
import styles from './styles.css';
import { useState } from "react";
import dayjs from "dayjs";
import { authenticator } from "~/auth.server";
import { getLinkedItems } from "~/services/linkedItemService";
import TransactionView, { Transaction, buildPersonalizationView } from "~/components/transactionView";
import { load } from "~/services/transactions";

export const meta: MetaFunction = () => {
  return [
    { title: "Mander" },
    { name: "description", content: "Welcome to Mander!" },
  ];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
}

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect('/login');
  }
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || currentMonth();
  const start = dayjs(period).startOf('month').format('YYYY-MM-DD');
  const end = dayjs(period).endOf('month').format('YYYY-MM-DD');
  const linkToken = await plaidApi.getLinkToken(user.userId);
  const items = await getLinkedItems(user.userId);
  const allAccounts = [];
  const allTransactions = [];
  for await (const item of items) {
    const [accounts, transactions] = await Promise.all([
      plaidApi.getAccounts(item.accessToken),
      plaidApi.getTransactions(item.accessToken, start, end)
    ]);
    allAccounts.push(...accounts);
    allTransactions.push(...transactions);
  }
  const mappedTransactions = allTransactions.map(transaction => ({
    name: transaction.name,
    amount: transaction.amount,
    date: transaction.date,
    category: transaction.category,
    id: transaction.transaction_id,
    logo: transaction.logo_url,
    canDelete: false,
  } as Transaction));
  const events = await load(user.userId);
  return { linkToken, allAccounts, allTransactions: mappedTransactions, period, events };
};

function breakdownByCategory(transactions: Transaction[]) {
  return transactions.reduce((categories: { [key: string]: number }, transaction: Transaction) => {
    const category = transaction.category?.[0] || 'Uncategorized';
    categories[category] = (categories[category] || 0) - transaction.amount;
    return categories;
  }, {});
}

const needsCategories = [
  'Food',
  'Housing',
  'Utilities',
  'Transportation',
  'Healthcare',
  'Insurance',
  'Childcare',
  'Debt',
  'Personal Care',
  'Clothing',
  'Education',
  'Savings',
  'Giving',
  'Entertainment',
  'Miscellaneous',
  'Telecommunication Services',
  'Loans and Mortgages',
  'Gas Stations',
  'Supermarkets and Groceries',
  'Utilities',
];

function breakdown50_30_20(transactions: Transaction[]) {
  const needs = transactions.filter(transaction => transaction.category?.some(category => needsCategories.includes(category)));
  const needsAmount = needs.reduce((sum, transaction) => sum + transaction.amount, 0);
  const categoryBreakdown = Object.values(breakdownByCategory(transactions));
  const spending = categoryBreakdown.filter(amount => amount < 0);
  const totalSpending = -spending.reduce((sum, amount) => sum + amount, 0);
  const wantsAmount = totalSpending - needsAmount;
  const savings = Math.max(transactions.reduce((sum, transaction) => sum - transaction.amount, 0), 0);
  return {
    Needs: needsAmount,
    Wants: wantsAmount,
    Savings: savings,
  }
}

function getPercentage(amount: number, total: number) {
  return Math.round(amount / total * 100);
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
  const view = buildPersonalizationView(data.events);
  let transactions = view.combineTransactionsForPeriod(data.allTransactions, period);
  transactions = transactions.filter((transaction: Transaction) => {
    if (categoryFilter) {
      return transaction.category?.includes(categoryFilter);
    }
    return true;
  }).sort(sortByDate);
  const netWorth = data.allAccounts.reduce((sum: number, account: plaidApi.Account) => {
    const balance = getBalance(account);
    return sum + balance;
  }, 0);
  const totalIncome = transactions
    .filter(transaction => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return (
    <div style={{ lineHeight: "1.8" }}>
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
      </h2>
      <p>
        <form className="period">
          <input type="month" name="period" defaultValue={period} />
          <button>Go</button>
        </form>
        Showing transactions from {dayjs(period).format('MMMM, YYYY')} 
        {categoryFilter && <strong> for {categoryFilter}</strong>}
      </p>
      <details open> 
        <summary>Breakdown by Category</summary>
        <table className="breakdown">
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
            {Object.entries(breakdownByCategory(transactions)).map(([category, amount]) => (
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
              <th colSpan={2}>{formatCurrency(transactions.reduce((sum: number, transaction: Transaction) => sum - transaction.amount, 0), 'USD')}</th>
            </tr>
          </tfoot>
        </table>
      </details>
      <details open>
        <summary>50/30/20 Rule</summary>
        <table className="breakdown">
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(breakdown50_30_20(transactions)).map(([category, amount]) => (
              <tr key={category}>
                <td>{category}</td>
                <td>{formatCurrency(amount, 'USD')} ({formatPercentage(amount, totalIncome)})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="add-transaction">
        See something missing? <a href="/transactions/add">Add it!</a>
      </div>
      <ul className="transaction-list">
        {transactions.map((transaction: Transaction) => (
          <li key={transaction.id}>
            <TransactionView 
              transaction={transaction} 
              categoryLookup={view.personalCategoryLookup} 
              deletedCategoryLookup={view.deletedCategoryLookup} 
            />
            <details hidden>
              <summary>Code</summary>
              <pre>{JSON.stringify(transaction, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

const sortByDate = (a: Transaction, b: Transaction) => {
  return dayjs(a.date).isBefore(dayjs(b.date)) ? 1 : -1;
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const formatPercentage = (amount: number, total: number) => {
  return `${getPercentage(amount, total)}%`;
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
  return (
    <div className="account-balance">
      <h3>{formatCurrency(balance, account.balances.iso_currency_code)}</h3>
      <span>{account.name} *{account.mask}</span>
      <details hidden>
        <summary>Code</summary>
        <pre>{JSON.stringify(account, null, 2)}</pre>
      </details>
    </div>
  );
}