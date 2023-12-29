import { type MetaFunction, type LoaderFunction, redirect, LinksFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Chart, { DoughnutController } from 'chart.js/auto';
import { Doughnut } from 'react-chartjs-2';
import * as plaidApi from "~/services/plaidApiClient";
import styles from './styles.css';
import { useState } from "react";
import dayjs from "dayjs";
import { authenticator } from "~/auth.server";
import { getLinkedItems } from "~/services/linkedItemService";
import TransactionView, { Transaction, buildPersonalizationView } from "~/components/transactionView";
import { load } from "~/services/transactions";

Chart.register(DoughnutController);

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
  const events = await load(user.userId);
  return { allAccounts, allTransactions, period, events };
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
  const netWorth = data.allAccounts.reduce((sum: number, account: plaidApi.PlaidAccountResponse) => {
    const balance = getBalance(account);
    return sum + balance;
  }, 0);
  const totalIncome = transactions
    .filter(transaction => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const categoryBreakdown = breakdownByCategory(transactions);
  return (
    <div style={{ lineHeight: "1.8" }}>
      <div className="net-worth">
        <div className="account-balance">
          <h3>
            <u>{formatCurrency(netWorth, 'USD')}</u>
          </h3>
          <i>Net Worth</i>
        </div>
      </div>
      <h2 className="ribbon">
        Accounts
        <a href="/plaid/link">Link Account</a>
      </h2>
      <details>
        <summary>View {data.allAccounts.length} Accounts</summary>
        <ul className="account-list">
          {data.allAccounts.map((account: plaidApi.PlaidAccountResponse) => (
            <li key={account.account_id}>
              <AccountView account={account} />
            </li>
          ))}
        </ul>
      </details>
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
      <details> 
        <summary>Breakdown by Category</summary>
        <Doughnut data={{
          labels: Object.keys(categoryBreakdown).filter(category => categoryBreakdown[category] < 0),
          datasets: [{
            data: Object.values(categoryBreakdown).filter(amount => amount < 0),
            backgroundColor: [
              'rgb(255, 99, 132)', //- A vibrant pink
              'rgb(54, 162, 235)', //- A bright blue
              'rgb(255, 206, 86)', //- A golden yellow
              'rgb(75, 192, 192)', //- A soft turquoise
              'rgb(153, 102, 255)', //- A light purple
              'rgb(255, 159, 64)', //- A rich orange
              'rgb(199, 199, 199)', //- A neutral grey
              'rgb(116, 185, 255)', //- A sky blue
              'rgb(255, 118, 117)', //- A coral red
              'rgb(104, 109, 224)', //- A deep periwinkle
            ],
            hoverOffset: 4
          }]
        }} />
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
            {Object.entries(categoryBreakdown).sort(sortCategoryByAmount).map(([category, amount]) => (
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
        <Doughnut data={{
          labels: Object.keys(breakdown50_30_20(transactions)),
          datasets: [{
            data: Object.values(breakdown50_30_20(transactions)),
            backgroundColor: [
              'rgb(255, 99, 132)',
              'rgb(54, 162, 235)',
              'rgb(255, 205, 86)',
            ],
            hoverOffset: 4
          }]
        }} />
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

const sortCategoryByAmount = ([aCategory, aAmount]: [string, number], [bCategory, bAmount]: [string, number]) => {
  return aAmount > bAmount ? 1 : -1;
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const formatPercentage = (amount: number, total: number) => {
  return `${getPercentage(amount, total)}%`;
}

const getBalance = (account: plaidApi.PlaidAccountResponse) => {
  return account.type === 'credit' ? -account.balances.current : account.balances.current;
}

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

const AccountView = ({ account }: { account: plaidApi.PlaidAccountResponse }) => {
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
