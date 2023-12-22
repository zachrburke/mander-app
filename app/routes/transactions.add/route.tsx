import { type MetaFunction, type LoaderFunction, redirect, LinksFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import dayjs from "dayjs";
import { authenticator } from "~/auth.server";
import { load, Events } from "~/services/transactions";
import * as plaidApi from "~/services/plaidApiClient";
import { getLinkedItems } from "~/services/linkedItemService";
import styles from './styles.css';
import TransactionView, { CategoryLookup, Transaction } from "~/components/transactionView";

export const meta: MetaFunction = () => {
  return [
    { title: "Mander" },
    { name: "description", content: "Welcome to Mander!" },
  ];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect('/login');
  const items = await getLinkedItems(user.userId);
  const accounts = [];
  for await (const item of items) {
    const accountsForItem = await plaidApi.getAccounts(item.accessToken);
    accounts.push(...accountsForItem);
  }
  const events = await load(user.userId);
  return { events, accounts };
}

function transactionView(events: Events[]) {
  const initialView = { transactions: [] as Transaction[], categories: {} as CategoryLookup, deleted: [] as string[] };
  return events.reduce((view, event) => {
    if (event.kind === 'transaction-added') {
      view.transactions.push({
        id: event.transactionId,
        name: event.name,
        amount: event.amount,
        date: event.date,
      });
    } else if (event.kind === 'transaction-categorized') {
      view.categories[event.transactionId] = view.categories[event.transactionId] || [];
      view.categories[event.transactionId].push(event.category);
    }
    else if (event.kind === 'category-removed') {
      view.categories[event.transactionId] = view.categories[event.transactionId] || [];
      view.categories[event.transactionId] = view.categories[event.transactionId].filter(c => c !== event.category);
    }
    else if (event.kind === 'transaction-removed') {
      view.deleted.push(event.transactionId);
    }
    return view;
  }, initialView);
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const view = transactionView(data.events);
  return (
    <section>
      <h1>Missing something?</h1>
      <p>
        Can't find a transaction after linking your account, <br />
        or need a way to even out your balance because an account doesn't exist anymore?
      </p>
      <fieldset>
        <legend>Add a Transaction</legend>
        <form method="post" action="/transactions/command?redirect=/transactions/add">
          <input type="hidden" name="kind" value="add-transaction" />
          <label>
            <small>Amount</small>
            <input type="number" name="amount" required placeholder="12.99" step="0.01" />
          </label>
          <label>
            <small>Description</small>
            <input type="text" name="name" required placeholder="CANNON'S IRISH PUB" />
          </label>
          <label>
            <small>Date</small>
            <input type="date" name="date" required />
          </label>
          <label>
            <small>Account</small>
            <select name="account" required>
              <option value="">Select an account</option>
              {data.accounts.map(account => (
                <option key={account.account_id} value={account.account_id}>{account.name} - {account.mask}</option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button>Add</button>
          </div>
        </form>
      </fieldset>
      <h2>Recently Added</h2>
      <ul>
        {view.transactions.filter(x => !view.deleted.includes(x.id)).sort(sortByDate).map(transaction => (
          <li key={transaction.id}>
            <TransactionView transaction={transaction} categoryLookup={view.categories} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const sortByDate = (a: Transaction, b: Transaction) => {
  return dayjs(a.date).isBefore(dayjs(b.date)) ? 1 : -1;
}