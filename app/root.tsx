import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import netlifyIdentity from "netlify-identity-widget";
import { useEffect } from "react";
import styles from "~/styles/site.css";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export default function App() {
  useEffect(() => {
    netlifyIdentity.init();
  });
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="stylesheet" href={styles} />
        <Meta />
        <Links />
      </head>
      <body>
        <header>
          <img className="logo" src="/logo.png" alt="FIRE Mana" />
          <h1>FIRE Mana</h1>
          <p className="subheading">Your 🔥 boost toward financial independence</p>
        </header>
        <main>
          <div>
            <button onClick={() => netlifyIdentity.open()}>Login with Netlify</button>
          </div>
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
