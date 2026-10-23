// Redis owns the clock and updates the counter and its expiry atomically.
// One hash per client/route/limiter also works on Redis Cluster.
export const RATE_LIMIT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local duration = tonumber(ARGV[3])
local state = redis.call('HMGET', KEYS[1], 'hits', 'expires', 'blocked')
local hits = tonumber(state[1]) or 0
local expires = tonumber(state[2]) or 0
local blocked = tonumber(state[3]) or 0
if blocked > now then
  return {hits, math.max(0, math.ceil((expires - now) / 1000)), 1, math.ceil((blocked - now) / 1000)}
end
if expires <= now or blocked > 0 then
  hits = 0
  expires = now + ttl
  blocked = 0
end
hits = hits + 1
if hits > limit then blocked = now + duration end
redis.call('HSET', KEYS[1], 'hits', hits, 'expires', expires, 'blocked', blocked)
redis.call('PEXPIRE', KEYS[1], math.max(expires, blocked) - now)
return {hits, math.ceil((expires - now) / 1000), blocked > now and 1 or 0, math.max(0, math.ceil((blocked - now) / 1000))}
`;
