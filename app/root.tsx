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
import { createContext, useEffect, useState } from "react";
import styles from "~/styles/site.css";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    netlifyIdentity.init();
    netlifyIdentity.on("login", () => {
      setIsLoggedIn(true);
    });
    netlifyIdentity.on("logout", () => {
      setIsLoggedIn(false);
    });
    const user = netlifyIdentity.currentUser();
    setIsLoggedIn(user && user.id);
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
            {!isLoggedIn && <button onClick={() => netlifyIdentity.open()}>Login with Netlify</button>}
            {isLoggedIn && <button onClick={() => netlifyIdentity.logout()}>Logout</button>}
          </div>

          {isLoggedIn && <Outlet />}
          {!isLoggedIn && <div>Not logged in</div>}
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
