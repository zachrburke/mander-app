import { ActionFunctionArgs, redirect, json } from "@remix-run/node";
import { getSession, commitSession } from "../sessions";

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const body = await request.json();
  session.set('userId', body.userId);
  session.set('email', body.email);
  return json({ status: 'success' }, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  })
};