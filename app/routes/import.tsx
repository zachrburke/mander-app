import { LoaderFunction, ActionFunction } from '@remix-run/node';
import { redirect, useLoaderData } from '@remix-run/react';
import { useEffect, useState } from 'react';
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
  return { items: items.map(item => item.itemId) };
};

export type ItemData = {
  itemId: string;
  accounts: plaidApi.ManderAccount[];
  transactions: Transaction[];
  cursor: string;
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

async function getSyncResult(itemId: string, cursor: string | null): Promise<plaidApi.TransactionSyncResult> {
  let url = `/import/sync?itemId=${itemId}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  const response = await fetch(url);
  return await response.json();
}

export default function Import() {
  const data = useLoaderData<typeof loader>();
  useEffect(() => {
    let itemData: ItemData[] = [];
    const currentItemData = localStorage.getItem('itemData');
    if (currentItemData) {
      itemData = JSON.parse(currentItemData);
    }
    const fetchData = async () => {
      for await (const itemId of data.items) {
        const item = itemData.find(item => item.itemId === itemId);
        const syncResult = await getSyncResult(itemId, item? item.cursor : null);
        if (item) {
          applySyncResult(item, syncResult);
        } else {
          itemData.push({ itemId, accounts: syncResult.accounts, transactions: syncResult.added, cursor: syncResult.cursor});
        }
      }
    };
    fetchData().then(() => {
      localStorage.setItem('itemData', JSON.stringify(itemData));
      parent.postMessage({ type: 'synced' });
    });
  }, []);

  return (
    <div>
      <h1>Import</h1>
      <h3>Syncing {data.items.length} item(s)</h3>
    </div>
  );
}