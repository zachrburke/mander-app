import { LoaderFunction, json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { PlaidLinkOptions, usePlaidLink } from "react-plaid-link";
import { authenticator } from "~/auth.server";
import * as plaidApi from "~/services/plaidApiClient";

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect('/login');
  }
  const linkToken = await plaidApi.getLinkToken(user.userId);
  return json({ linkToken });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const config: PlaidLinkOptions = {
    onSuccess: (public_token, metadata) => {
      window.location.href = `/complete-link-account?public_token=${public_token}`;
    },
    token: data.linkToken,
  };
  const { open, ready } = usePlaidLink(config);
  return (
    <div>
      <h1>Link your account</h1>
      <p>
        To get started, link your bank account(s) to Mander. We use Plaid to link your account securely.
      </p>
      <button onClick={() => open()} disabled={!ready}>Link account with Plaid</button>
    </div>
  );
}