import { type MetaFunction, type LoaderFunction, redirect, LinksFunction, json } from "@remix-run/node";
import { Form, useFetcher, useLoaderData, useNavigation } from "@remix-run/react";
import dayjs from "dayjs";
import { authenticator } from "~/auth.server";
import { load, Events } from "~/services/transactions";
import * as plaidApi from "~/services/plaidApiClient";
import { getLinkedItems } from "~/services/linkedItemService";
import styles from './styles.css';
import TransactionView, { Transaction, buildPersonalizationView } from "~/components/transactionView";
import { useEffect } from "react";

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
    const accountsForItem = await plaidApi.getAccounts(item);
    accounts.push(...accountsForItem);
  }
  const events = await load(user.userId);
  return { events, accounts };
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const addTransactionAction = '/transactions/command?redirect=/transactions/add';
  const isSubmitting = navigation.formAction === addTransactionAction;
  const view = buildPersonalizationView(data.events);
  return (
    <section>
      <h1>Missing something?</h1>
      <p>
        Can't find a transaction after linking your account, <br />
        or need a way to even out your balance because an account doesn't exist anymore?
      </p>
      <fieldset disabled={isSubmitting}>
        <legend>Add a Transaction</legend>
        <Form method="post" action={addTransactionAction} key={Math.random()}>
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
        </Form>
      </fieldset>
      <h2>Recently Added</h2>
      <ul>
        {view.transactions.sort(sortByDate).map(transaction => (
          <li key={transaction.id}>
            <TransactionView transaction={transaction} categoryLookup={view.personalCategoryLookup} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const sortByDate = (a: Transaction, b: Transaction) => {
  return dayjs(a.date).isBefore(dayjs(b.date)) ? 1 : -1;
}