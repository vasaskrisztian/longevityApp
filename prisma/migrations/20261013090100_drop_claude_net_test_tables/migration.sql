-- Two scratch tables left in the production database by an earlier network
-- connectivity test from a Claude session. They are not part of the Prisma schema and
-- nothing in the app reads or writes them.
DROP TABLE IF EXISTS "_claude_net_test";
DROP TABLE IF EXISTS "_claude_net_test2";
