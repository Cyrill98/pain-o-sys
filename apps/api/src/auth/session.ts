import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { config } from '../config.js';
import { pool } from '../db/index.js';

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
  }
}

const PgStore = connectPgSimple(session);

export const SESSION_COOKIE = 'sid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
  secret: config.SESSION_SECRET,
  store: new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false, // created by migrations
    pruneSessionInterval: config.NODE_ENV === 'test' ? false : 60 * 60, // hourly
  }),
  resave: false,
  saveUninitialized: false, // no cookie for guests
  rolling: true, // stay signed in while she keeps using it
  cookie: {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    maxAge: THIRTY_DAYS_MS,
  },
});
