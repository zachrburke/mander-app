import {LoaderFunction} from '@remix-run/node';
import { redirect } from '@remix-run/react';
import { authenticator } from '~/auth.server';
import { getLinkedItems, saveCursor } from '~/services/linkedItemService';
import * as plaidApi from '~/services/plaidApiClient';

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect('/login');
  }
  const url = new URL(request.url);
  const itemId = url.searchParams.get('itemId');
  const cursor = url.searchParams.get('cursor') ?? null;
  const items = await getLinkedItems(user.userId);
  const item = items.find(item => item.itemId === itemId);
  if (!item) throw new Error('Item not found: ' + itemId);
  const syncResult = await plaidApi.syncTransactions(item.itemId, item.accessToken, cursor);
  return syncResult;
}