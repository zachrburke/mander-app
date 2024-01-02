import { TrashIcon } from "@heroicons/react/24/solid";
import { useFetcher } from "@remix-run/react";
import dayjs from "dayjs";
import { Events } from "~/services/transactions";

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string[];
  logo?: string;
  canDelete: boolean;
  isNeed: boolean;
}

export type CategoryLookup = {
  [key: string]: string[];
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
    public personalCategoryLookup: CategoryLookup = {},
    public deletedCategoryLookup: CategoryLookup = {},
  ) {}
  hasPersonalCategory(transactionId: string, category: string): boolean {
    return this.personalCategoryLookup[transactionId]?.includes(category);
  }
  hasDeletedCategory(transactionId: string, category: string): boolean {
    return this.deletedCategoryLookup[transactionId]?.includes(category);
  }
  addPersonalCategory(transactionId: string, category: string) {
    if (this.hasPersonalCategory(transactionId, category)) return;
    this.personalCategoryLookup[transactionId] = this.personalCategoryLookup[transactionId] || [];
    this.personalCategoryLookup[transactionId].push(category);
    this.deletedCategoryLookup[transactionId] = this.deletedCategoryLookup[transactionId]?.filter(c => c !== category);
  }
  addDeletedCategory(transactionId: string, category: string) {
    if (this.hasDeletedCategory(transactionId, category)) return;
    this.deletedCategoryLookup[transactionId] = this.deletedCategoryLookup[transactionId] || [];
    this.deletedCategoryLookup[transactionId].push(category);
    this.personalCategoryLookup[transactionId] = this.personalCategoryLookup[transactionId]?.filter(c => c !== category);
  }
  personalizeTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.map(transaction => {
      let categories = this.personalCategoryLookup[transaction.id] || [];
      const deletedCategories = this.deletedCategoryLookup[transaction.id] || [];
      transaction.category = transaction.category?.filter(category => !deletedCategories.includes(category));
      categories = [...categories, ...transaction.category || []];
      return {
        ...transaction,
        category: categories,
        isNeed: needsCategories.some(need => categories.includes(need)),
      };
    });
  }
  combineTransactionsForPeriod(transactions: Transaction[], period: string): Transaction[] {
    const transactionsForPeriod = this.transactions.filter(transaction => {
      return dayjs(transaction.date).month() === dayjs(period).month();
    });
    return this.personalizeTransactions(transactions).concat(transactionsForPeriod);
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

export function buildPersonalizationView(events: Events[]) {
  const initialView = new PersonalizationView();
  return events.reduce((view, event) => {
    const transaction = view.transactions.find(transaction => transaction.id === event.transactionId);
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
    else if (event.kind === 'transaction-categorized' && transaction) {
      transaction.category!.push(event.category);
    }
    else if (event.kind === 'category-removed' && transaction) {
      transaction.category = transaction.category!.filter(category => category !== event.category);
    }
    else if (event.kind === 'transaction-categorized' && !transaction) {
      view.addPersonalCategory(event.transactionId, event.category);
    }
    else if (event.kind === 'category-removed' && !transaction) {
      view.addDeletedCategory(event.transactionId, event.category);
    }
    else if (event.kind === 'transaction-removed') {
      view.transactions = view.transactions.filter(transaction => transaction.id !== event.transactionId);
    }
    return view;
  }, initialView);
}

export default function TransactionView({ transaction, categoryLookup, deletedCategoryLookup }: {
  transaction: Transaction, 
  categoryLookup: CategoryLookup,
  deletedCategoryLookup?: CategoryLookup
}) {
  const fetcher = useFetcher();
  const Form = fetcher.Form;
  const deletedCategories = deletedCategoryLookup || {};
  let categories = transaction.category || [];
  categories = categories.concat(categoryLookup[transaction.id] || []);
  categories = categories.filter(category => !deletedCategories[transaction.id]?.includes(category));
  categories = categories.filter((category, index) => categories.indexOf(category) === index);
  return (
    <fieldset className="transaction" disabled={fetcher.state !== 'idle'}>
      <h3 className="title">{transaction.name}</h3>
      <img className="logo" src={transaction.logo ?? '/logo.png'} />
      <span className="category">
        {!categories.length && <span className="empty">Uncategorized</span>}
        {categories.map(category => (
          <span className={needsCategories.includes(category) ? 'is-need' : ''} key={category}>{category}</span>
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
              <li key={category}>
                <Form method="post" action="/transactions/command" preventScrollReset={true}>
                  <input type="hidden" name="kind" value="remove-category" />
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <input type="hidden" name="category" value={category} />
                  <button>Remove {category}</button>
                </Form>
              </li>
            ))}
          </ul>
        </nav>
        <Form method="post" action="/transactions/command" preventScrollReset={true}>
          <input type="hidden" name="kind" value="categorize-transaction" />
          <input type="hidden" name="transactionId" value={transaction.id} />
          <label>
            <small>Category</small>
            <input type="text" name="category" />
          </label>
          <button>Add</button>
        </Form>
      </details>
    </fieldset>
  );
}
