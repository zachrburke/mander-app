import * as redis from '../redis.server';

export type Command = {
  kind: string;
  occurredAt?: string;
}

type UnknownCommand = Command & {
  kind: 'unknown';
}

export type Event = {
  kind: string;
  occurredAt: string;
}

export type AddTransaction = Command & {
  kind: 'add-transaction';
  accountId: string;
  transactionId: string;
  amount: number;
  date: string;
  name: string;
}

export type TransactionAdded = Event & {
  kind: 'transaction-added';
  accountId: string;
  transactionId: string;
  amount: number;
  date: string;
  name: string;
}

export type CategorizeTransaction = Command & {
  kind: 'categorize-transaction';
  transactionId: string;
  category: string;
}

export type TransactionCategorized = Event & {
  kind: 'transaction-categorized';
  transactionId: string;
  category: string;
}

export type RemoveCategory = Command & {
  kind: 'remove-category';
  transactionId: string;
  category: string;
}

export type CategoryRemoved = Event & {
  kind: 'category-removed';
  transactionId: string;
  category: string;
}

export type RemoveTransaction = Command & {
  kind: 'remove-transaction';
  transactionId: string;
}

export type TransactionRemoved = Event & {
  kind: 'transaction-removed';
  transactionId: string;
}

export type Events = TransactionAdded 
  | TransactionCategorized
  | CategoryRemoved
  | TransactionRemoved;

type Commands = AddTransaction
  | CategorizeTransaction
  | RemoveCategory
  | RemoveTransaction
  | UnknownCommand;


export function *handleCommand(command: Commands) : Generator<Events> {
  const occurredAt = new Date().toISOString();
  switch (command.kind) {
    case 'add-transaction':
      return yield { ...command, occurredAt, kind: 'transaction-added' };
    case 'categorize-transaction':
      return yield { ...command, occurredAt, kind: 'transaction-categorized' };
    case 'remove-category':
      return yield { ...command, occurredAt, kind: 'category-removed' };
    case 'remove-transaction':
      return yield { ...command, occurredAt, kind: 'transaction-removed' };
    default:
      throw new Error(`Unknown command kind: ${command.kind}`);
  }
}

export async function persist(userId: string, command: Commands) {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const events = handleCommand(command);
  for (const event of events) {
    const eventRecord: Record<string, RedisCommandArgument> = Object.entries(event).reduce(
      (acc, [key, value]) => ({ ...acc, [key]: String(value) }), {}
    );
    await client.xAdd(`user:${userId}:events`, '*', eventRecord);
    console.log(`Persisted event: ${JSON.stringify(event)}`);
  }
  await client.quit();
}

export async function load(userId: string): Promise<Event[]> {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const stream = await client.xRead({ key: `user:${userId}:events`, id: '0-0' });
  await client.quit();
  if (!stream || stream.length === 0) return [];
  return stream[0].messages.map(message => {
    return { ...message.message } as Event;
  });
}

export async function nextId(userId: string) {
  const client = redis.createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const id = await client.incr(`user:${userId}:nextTransactionId`);
  await client.quit();
  return id;
}
