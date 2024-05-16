import { LoaderFunction } from '@remix-run/node';
import { redirect, useLoaderData } from '@remix-run/react';
import { useEffect } from 'react';
import { authenticator } from '~/auth.server';
import { getLinkedItems, saveCursor } from '~/services/linkedItemService';
import * as plaidApi from '~/services/plaidApiClient';
import { Transaction } from '../components/transactionView';

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect('/login');
  }
  const items = await getLinkedItems(user.userId);
  const syncResults = [];
  for await (const item of items) {
    const syncResult = await plaidApi.syncTransactions(item.itemId, item.accessToken, item.cursor);
    syncResults.push(syncResult);
    await saveCursor(user.userId, item.itemId, syncResult.cursor);
  }
  return { syncResults };
};

export type ItemData = {
  itemId: string;
  accounts: plaidApi.ManderAccount[];
  transactions: Transaction[];
};

function applySyncResult(itemData: ItemData, syncResult: plaidApi.TransactionSyncResult) {
  // add new transactions
  itemData.transactions.push(...syncResult.added);

  // remove deleted transactions
  const removedIds = new Set(syncResult.removed.map(transaction => transaction.id));
  itemData.transactions = itemData.transactions.filter(transaction => !removedIds.has(transaction.id));

  // update modified transactions
  for (const modified of syncResult.modified) {
    const index = itemData.transactions.findIndex(transaction => transaction.id === modified.id);
    itemData.transactions[index] = modified;
  }

  // update account info
  itemData.accounts = syncResult.accounts;
}

export default function Import() {
  const data = useLoaderData<typeof loader>();
  useEffect(() => {
    let itemData: ItemData[] = [];
    const currentItemData = localStorage.getItem('itemData');
    if (currentItemData) {
      itemData = JSON.parse(currentItemData);
    }
    for (const syncResult of data.syncResults) {
      const item = itemData.find(item => item.itemId === syncResult.itemId);
      if (item) {
        applySyncResult(item, syncResult);
      } else {
        itemData.push({
          itemId: syncResult.itemId,
          accounts: syncResult.accounts,
          transactions: syncResult.added,
        });
      }
    }
    localStorage.setItem('itemData', JSON.stringify(itemData));
    parent.postMessage({ type: 'synced' });
  }, []);

  return (
    <div>
      <h1>Import</h1>
      <h3>Synced up {data.syncResults.length} item(s)</h3>
    </div>
  );
}