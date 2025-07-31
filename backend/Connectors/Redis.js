import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD
} = process.env;

let redisClient;

export async function initRedis() {
  try {
    redisClient = createClient({
      url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
      password: REDIS_PASSWORD,
      socket: {
        connectTimeout: 10000, // 10 seconds
      },
    });

    redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));

    await redisClient.connect();
    //console.log('✅ Redis connected successfully!');
    return redisClient;
  } catch (error) {
    console.error('❌ Redis Initialization Error:', error.message);
    process.exit(1);
  }
}

export { redisClient };
