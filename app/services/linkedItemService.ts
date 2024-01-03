import { createClient } from "~/redis.server";

export type LinkedItem = {
  itemId: string;
  accessToken: string;
};

export async function getLinkedItems(userId: string): Promise<LinkedItem[]> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const itemIds = await client.sMembers(`user:${userId}:items`);
  const items = [];
  for (const itemId of itemIds) {
    const item = await client.hGetAll(`user:${userId}:${itemId}`);
    items.push(item);
  }
  client.quit();
  return items.map(item => ({ itemId: item.itemId, accessToken: item.accessToken }));
}