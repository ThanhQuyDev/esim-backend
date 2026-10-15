/**
 * The API always runs on UTC (doitac-1410 #028).
 *
 * The timestamp columns hold UTC wall-clock time, and the Postgres driver
 * writes a JS Date in the process's own zone. On a machine set to Vietnam
 * time every day boundary moved by 7 hours — "Hôm nay" lost an order placed
 * at 02:35 to "Hôm qua". Fixing the zone here keeps the API correct whatever
 * the host is set to. Imported first, before anything reads a clock.
 */
process.env.TZ = 'UTC';

export {};
