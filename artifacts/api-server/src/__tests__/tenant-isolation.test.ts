import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  clubsTable,
  coachesTable,
  playersTable,
  rostersTable,
  rosterPlayersTable,
  coachWishlistTable,
  coachMustHaveTable,
} from "@workspace/db";
import app from "../app";

// Regression tests for three cross-tenant isolation bugs found in review:
//  - coach wishlist/must-have endpoints didn't verify the coach belongs to the caller's club
//  - roster-player delete didn't verify the roster belongs to the caller's club
// Each test proves club B, authenticated with its own valid token, cannot
// read or mutate club A's data via club A's resource IDs.

let clubA: { id: number };
let clubB: { id: number };
let tokenA: string;
let tokenB: string;
let coachA: { id: number };
let playerA: { id: number };
let rosterA: { id: number };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const [a] = await db.insert(clubsTable).values({
    name: "Club A", email: "club-a@example.com", passwordHash: "x", status: "active",
  }).returning();
  const [b] = await db.insert(clubsTable).values({
    name: "Club B", email: "club-b@example.com", passwordHash: "x", status: "active",
  }).returning();
  clubA = a;
  clubB = b;
  tokenA = jwt.sign({ clubId: clubA.id }, process.env["JWT_SECRET"]!);
  tokenB = jwt.sign({ clubId: clubB.id }, process.env["JWT_SECRET"]!);

  const [coach] = await db.insert(coachesTable).values({ clubId: clubA.id, name: "Coach A", teamName: "Team A" }).returning();
  coachA = coach;
  const [player] = await db.insert(playersTable).values({ clubId: clubA.id, name: "Player A" }).returning();
  playerA = player;
  const [roster] = await db.insert(rostersTable).values({ clubId: clubA.id, name: "Roster A" }).returning();
  rosterA = roster;
  await db.insert(rosterPlayersTable).values({ rosterId: rosterA.id, playerId: playerA.id, position: "OH" });
});

afterAll(async () => {
  await pool.end();
});

describe("cross-tenant isolation", () => {
  it("club B cannot read club A's coach wishlist", async () => {
    const res = await request(app).get(`/api/coaches/${coachA.id}/wishlist`).set(authHeader(tokenB));
    expect(res.status).toBe(404);
  });

  it("club B cannot add to club A's coach wishlist", async () => {
    const res = await request(app)
      .post(`/api/coaches/${coachA.id}/wishlist`)
      .set(authHeader(tokenB))
      .send({ playerId: playerA.id });
    expect(res.status).toBe(404);

    const rows = await db.select().from(coachWishlistTable).where(eq(coachWishlistTable.coachId, coachA.id));
    expect(rows.length).toBe(0);
  });

  it("club B cannot read or write club A's coach must-have list", async () => {
    const getRes = await request(app).get(`/api/coaches/${coachA.id}/musthave`).set(authHeader(tokenB));
    expect(getRes.status).toBe(404);

    const postRes = await request(app)
      .post(`/api/coaches/${coachA.id}/musthave`)
      .set(authHeader(tokenB))
      .send({ playerId: playerA.id });
    expect(postRes.status).toBe(404);

    const rows = await db.select().from(coachMustHaveTable).where(eq(coachMustHaveTable.coachId, coachA.id));
    expect(rows.length).toBe(0);
  });

  it("club B cannot delete a player from club A's roster", async () => {
    const res = await request(app)
      .delete(`/api/rosters/${rosterA.id}/players/${playerA.id}`)
      .set(authHeader(tokenB));
    expect(res.status).toBe(404);

    const rows = await db.select().from(rosterPlayersTable).where(eq(rosterPlayersTable.rosterId, rosterA.id));
    expect(rows.length).toBe(1);
  });

  it("club A (the owner) can still read and write its own coach wishlist", async () => {
    const postRes = await request(app)
      .post(`/api/coaches/${coachA.id}/wishlist`)
      .set(authHeader(tokenA))
      .send({ playerId: playerA.id });
    expect(postRes.status).toBe(201);

    const getRes = await request(app).get(`/api/coaches/${coachA.id}/wishlist`).set(authHeader(tokenA));
    expect(getRes.status).toBe(200);
    expect(getRes.body).toContain(playerA.id);
  });
});
