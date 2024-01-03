import { type LoaderFunction, ActionFunction, redirect, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import dayjs from "dayjs";
import { useState } from "react";
import { authenticator } from "~/auth.server";
import { getLinkedItems } from "~/services/linkedItemService";
import * as plaidApi from "~/services/plaidApiClient";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect('/login');

  const months = [...Array(12)].map((_, i) => {
    const index = i + 1;
    const start = dayjs().subtract(index, 'month').startOf('month').format('YYYY-MM-DD');
    const end = dayjs().subtract(index, 'month').endOf('month').format('YYYY-MM-DD');
    return { start, end };
  });

  const linkedItems = await getLinkedItems(user.userId);
  const transactionsByItem = await Promise.all(linkedItems.map(async item => {
    const transactionsByMonth = await Promise.all(months.map(month => plaidApi.getTransactions(item.accessToken, month.start, month.end)));
    return transactionsByMonth.flat();
  }));
  const netWorth = await getNetWorth(user.userId);
  return json({ allTransactions: transactionsByItem.flat(), netWorth })
};

export const action: ActionFunction = async ({ request, context }) => {

}


async function getNetWorth(userId: string) {
  const linkedItems = await getLinkedItems(userId);
  const allAccounts = [];
  for await (const item of linkedItems) {
    const accounts = await plaidApi.getAccounts(item);
    allAccounts.push(...accounts);
  }
  return allAccounts.reduce((sum, account) => sum + account.balances.current, 0);
}

function breakdownByMonth(transactions: plaidApi.PlaidTransaction[]) {
  return transactions.reduce((months: { [key: string]: number }, transaction: plaidApi.PlaidTransaction) => {
    const month = dayjs(transaction.date).format('YYYY-MM');
    months[month] = (months[month] || 0) - transaction.amount;
    return months;
  }, {});
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function History() {
  const data = useLoaderData<typeof loader>();
  const [goal, setGoal] = useState(1_500_000);
  const breakdown = breakdownByMonth(data.allTransactions);
  const netGain = Object.values(breakdown).reduce((sum, amount) => sum + amount, 0);
  return (
    <div>
      <h1>History</h1>
      <p>Here's your spending history for the past year.</p>
      <p><a href="/">Back to Dashboard</a></p>
      <p>
        <strong>Net Worth: {formatCurrency(data.netWorth, 'USD')}</strong><br />    
        <strong>Retirement Goal: {formatCurrency(goal, 'USD')}</strong><br />
        <strong>Years to Retirement: {Math.round((goal - data.netWorth) / netGain)}</strong><br />
      </p>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(breakdown).map(month => (
            <tr key={month}>
              <td>
                <a href={`/?period=${month}`}>{dayjs(month).format('MMMM, YYYY')}</a>
              </td>
              <td>{formatCurrency(breakdown[month], 'USD')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Net Gain</td>
            <td>
              <strong>
                {formatCurrency(netGain, 'USD')}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}