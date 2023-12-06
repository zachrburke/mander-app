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
  const [user, setUser] = useState(null);
  useEffect(() => {
    netlifyIdentity.init();
    netlifyIdentity.on("login", () => {
      setIsLoggedIn(true);
      setUser(netlifyIdentity.currentUser());
    });
    netlifyIdentity.on("logout", () => {
      setIsLoggedIn(false);
      setUser(null);
    });
    const user = netlifyIdentity.currentUser();
    setIsLoggedIn(user && user.id);
    setUser(user);
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
          <img className="logo" src="/logo.png" alt="Mander" />
          <h1>Mander</h1>
          <p className="subheading">Your 🔥 boost toward financial independence</p>
          <LoginView user={user} isLoggedIn={isLoggedIn} />
        </header>
        <main>
          <pre hidden>{JSON.stringify(user, null, 2)}</pre>
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

const LoginView = ({ user, isLoggedIn }: { user: any, isLoggedIn: boolean }) => {
  if (!isLoggedIn) {
    return (
      <div className="login">
        <button onClick={() => netlifyIdentity.open()}>Login with Netlify</button>
      </div>
    )
  }
  return (
    <div className="login">
      <span>{user && (user.user_metadata.full_name || user.email)}</span>
      <button onClick={() => netlifyIdentity.logout()}>Logout</button>
    </div>
  )
}