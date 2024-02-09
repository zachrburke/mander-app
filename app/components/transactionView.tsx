import { TrashIcon } from "@heroicons/react/24/solid";
import { useFetcher } from "@remix-run/react";
import dayjs from "dayjs";
import { useState } from "react";
import { Events } from "~/services/transactions";

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: Category[];
  logo?: string;
  canDelete: boolean;
  isNeed: boolean;
}

export type CategoryLookup = {
  [key: string]: string[];
}

export type Category = {
  name: string;
  isNeed: boolean;
  isAutoCategorized: boolean;
  description?: string;
}

export const needsCategories = [
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
  'Rent',
];

// This represents data a user has added to what is already being pulled from plaid
export class PersonalizationView {
  constructor(
    public transactions: Transaction[] = [], 
  ) {}
  addCategory(transactionId: string, category: string, auto: boolean = false) {
    const transaction = this.transactions.find(transaction => transaction.id === transactionId);
    if (!transaction) return
    transaction.category = [...transaction.category];
    transaction.category.push({ name: category.trim(), isNeed: needsCategories.includes(category), isAutoCategorized: auto });
    transaction.category = transaction.category.filter((category, index) => transaction.category?.indexOf(category) === index);
  }
  removeCategory(transactionId: string, category: string) {
    const transaction = this.transactions.find(transaction => transaction.id === transactionId);
    if (!transaction) return;
    transaction.category = transaction.category?.filter(c => c.name !== category);
  }
}

function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    event.preventDefault();
    return false;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function buildPersonalizationView(events: Events[], transactions: Transaction[] = []) {
  const transactionsWithNeeds = transactions.map(transaction => {
    transaction.category = transaction.category.map(category => ({ ...category, isNeed: needsCategories.includes(category.name), isAutoCategorized: false }));
    return { ...transaction };
  });
  const initialView = new PersonalizationView(transactionsWithNeeds);
  return events.reduce((view, event) => {
    if (event.kind === 'transaction-added') {
      view.transactions.push({
        id: event.transactionId,
        name: event.name,
        amount: event.amount,
        date: event.date,
        category: [],
        canDelete: true,
        isNeed: false,
      });
    } 
    else if (event.kind === 'transaction-categorized') {
      view.addCategory(event.transactionId, event.category);
    }
    else if (event.kind === 'category-removed') {
      view.removeCategory(event.transactionId, event.category);
    }
    else if (event.kind === 'transaction-removed') {
      view.transactions = view.transactions.filter(transaction => transaction.id !== event.transactionId);
    }
    else if (event.kind === 'auto-categorization-added') {
      for (const transaction of view.transactions) {
        if (transaction.name === event.name) {
          view.addCategory(transaction.id, event.category, true);
        }
      }
    }
    return view;
  }, initialView);
}

export default function TransactionView({ transaction }: {
  transaction: Transaction, 
}) {
  const fetcher = useFetcher();
  const [autoCategorize, setAutoCategorize] = useState(false);
  const Form = fetcher.Form;
  let categories = transaction.category;
  return (
    <fieldset className="transaction" disabled={fetcher.state !== 'idle'}>
      <h3 className="title">{transaction.name}</h3>
      <img className="logo" src={transaction.logo ?? '/logo.png'} />
      <span className="categories">
        {!categories.length && <span className="empty">Uncategorized</span>}
        {categories.map((category, i) => (
          <span className={`${category.isNeed ? 'is-need' : ''} category`} key={i}>{category.name}</span>
        ))}
      </span>
      <h3 className="amount">
        <Form method="post" action="/transactions/command" onSubmit={confirmDelete} >
          {formatCurrency(-transaction.amount)}
          <input type="hidden" name="kind" value="remove-transaction" />
          <input type="hidden" name="transactionId" value={transaction.id} />
          {transaction.canDelete && 
            <button className="subtle" title="Delete Transaction">
              <TrashIcon />
            </button>
          }
        </Form>
      </h3>
      <details className="categorize">
        <summary>Categorize</summary>
        <nav>
          <ul>
            {categories.map(category => (
              <li key={category.name}>
                <Form method="post" action="/transactions/command" preventScrollReset={true}>
                  <input type="hidden" name="kind" value="remove-category" />
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <input type="hidden" name="category" value={category.name} />
                  <button>Remove {category.name}</button>
                </Form>
              </li>
            ))}
          </ul>
        </nav>
        <Form method="post" action="/transactions/command" preventScrollReset={true}>
          <input type="hidden" name="kind" value={autoCategorize ? 'add-auto-categorization' : 'categorize-transaction'} />
          <input type="hidden" name="transactionId" value={transaction.id} />
          <input type="hidden" name="name" value={transaction.name} />
          <label>
            <small>Category</small>
            <input type="text" name="category" />
          </label>
          <button>Add</button>
          <label>
            <input type="checkbox" name="autoCategorize" checked={autoCategorize} onChange={() => setAutoCategorize(!autoCategorize)} />
            <span>Add for all <i>{transaction.name}</i>?</span>
          </label>
        </Form>
      </details>
    </fieldset>
  );
}
