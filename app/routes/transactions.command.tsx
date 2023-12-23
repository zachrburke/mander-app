// app/routes/auth/logout.ts
import type { ActionFunctionArgs } from "@remix-run/node";

import { redirect } from "@remix-run/node";
import { authenticator } from "~/auth.server";
import { AddTransaction, Commands, nextId, persist } from "~/services/transactions";

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect('/login');

  const form = await request.formData();
  const data = Object.fromEntries(form.entries()) as Commands;
  if (data.kind === 'add-transaction') {
    const transactionId = await nextId(user.userId);
    (data as AddTransaction).transactionId = transactionId.toString();
  }
  await persist(user.userId, data);
  const url = new URL(request.url);
  if (url.searchParams.get('redirect')) {
    return redirect(url.searchParams.get('redirect')!);
  }
  return data;
};

