import { TrashIcon } from "@heroicons/react/24/solid";
import dayjs from "dayjs";
import { Events } from "~/services/transactions";

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string[];
  logo?: string;
}

export type CategoryLookup = {
  [key: string]: string[];
}

function confirmDelete(event) {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    event.preventDefault();
    return false;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function transactionView(events: Events[]) {
  const initialView = {
    transactions: [] as Transaction[],
    categories: {} as CategoryLookup,
    deletedCategoryLookup: {} as CategoryLookup,
    deleted: [] as string[]
  };
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
    else if (event.kind === 'category-removed' && view.categories[event.transactionId]) {
      view.categories[event.transactionId] = view.categories[event.transactionId] || [];
      view.categories[event.transactionId] = view.categories[event.transactionId].filter(c => c !== event.category);
    }
    else if (event.kind === 'category-removed' && !view.categories[event.transactionId]) {
      view.deletedCategoryLookup[event.transactionId] = view.deletedCategoryLookup[event.transactionId] || [];
      view.deletedCategoryLookup[event.transactionId].push(event.category);
    }
    else if (event.kind === 'transaction-removed') {
      view.deleted.push(event.transactionId);
    }
    return view;
  }, initialView);
}

export default function TransactionView({ transaction, categoryLookup, deletedCategoryLookup }: {
  transaction: Transaction, 
  categoryLookup: CategoryLookup,
  deletedCategoryLookup?: CategoryLookup
}) {
  const deletedCategories = deletedCategoryLookup || {};
  let categories = transaction.category || [];
  categories = categories.concat(categoryLookup[transaction.id] || []);
  categories = categories.filter(category => !deletedCategories[transaction.id]?.includes(category));
  return (
    <div className="transaction">
      <h3 className="title">{transaction.name}</h3>
      <img className="logo" src={transaction.logo ?? '/logo.png'} />
      <span className="category">{(categories.length && categories.join(', ')) || "Uncategorized"}</span>
      <h3 className="amount">
        <form method="post" action="/transactions/command" onSubmit={confirmDelete} >
          {formatCurrency(-transaction.amount)}
          <input type="hidden" name="kind" value="remove-transaction" />
          <input type="hidden" name="transactionId" value={transaction.id} />
          <button className="subtle" title="Delete Transaction">
            <TrashIcon />
          </button>
        </form>
      </h3>
      <span className="date">{dayjs(transaction.date).format('MMM D, YYYY')}</span>
      <details className="categorize">
        <summary>Categorize</summary>
        <nav>
          <ul>
            {categories.map(category => (
              <li key={category}>
                <form method="post" action="/transactions/command" >
                  <input type="hidden" name="kind" value="remove-category" />
                  <input type="hidden" name="transactionId" value={transaction.id} />
                  <input type="hidden" name="category" value={category} />
                  <button>Remove {category}</button>
                </form>
              </li>
            ))}
          </ul>
        </nav>
        <form method="post" action="/transactions/command" >
          <input type="hidden" name="kind" value="categorize-transaction" />
          <input type="hidden" name="transactionId" value={transaction.id} />
          <label>
            <small>Category</small>
            <input type="text" name="category" />
          </label>
          <div className="actions">
            <button>Add</button>
          </div>
        </form>
      </details>
    </div>
  );
}