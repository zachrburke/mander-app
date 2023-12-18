import { createClient } from "~/lib/redis.server";

export async function getLinkedItems(userId: string) {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    const itemIds = await client.sMembers(`user:${userId}:items`);
    const items = [];
    for (const itemId of itemIds) {
      const item = await client.hGetAll(`user:${userId}:${itemId}`);
      items.push(item);
    }
    client.quit();
    return items;
  }