import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { User, Session, Institution, initializeModels } from "../src/models.js";
import { RefreshToken } from "../src/modules/auth/models.js";

const db = `codex_campus_refresh_${process.pid}_${randomBytes(6).toString("hex")}`;
const config = { ...readConfig(), allowInitialSetup: true, production: false };
let app, agent, session, refresh;
const login = {
  nombre: "Admin",
  correo: "refresh@example.test",
  password: "PruebaRefresh2026!",
};

describe("JWT y rotación de refresh tokens", () => {
  before(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || config.mongoUri, {
      dbName: db,
      serverSelectionTimeoutMS: 5000,
    });
    await initializeModels();
  });
  beforeEach(async () => {
    await Promise.all(
      [User, Session, RefreshToken, Institution].map((M) => M.deleteMany({})),
    );
    app = createApp(config);
    agent = request.agent(app);
    const response = await agent
      .post("/api/setup/administrador")
      .send(login)
      .expect(201);
    session = response.body.data;
    refresh = response.headers["set-cookie"]
      .find((c) => c.startsWith("campus_refresh="))
      .split(";")[0];
    assert.ok(
      response.headers["set-cookie"]
        .find((c) => c.startsWith("campus_refresh="))
        .includes("HttpOnly"),
    );
  });
  after(async () => {
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, db);
      assert.match(db, /^codex_campus_refresh_\d+_[a-f\d]{12}$/);
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it("emite JWT firmado y almacena solo el hash del refresh token", async () => {
    const decoded = jwt.verify(session.accessToken, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: "campus-api",
      audience: "campus-web",
    });
    assert.equal(decoded.sub, session.user.id);
    assert.equal(decoded.exp - decoded.iat, 900);
    const stored = await RefreshToken.findOne();
    assert.notEqual(stored.tokenHash, refresh.split("=")[1]);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + session.accessToken)
      .expect(200);
  });
  it("rechaza JWT vencido o alterado aunque la Cookie opaca todavía sea válida", async () => {
    const current = await Session.findOne();
    const expired = jwt.sign(
      {
        sid: String(current._id),
        ver: 0,
        iat: Math.floor(Date.now() / 1000) - 120,
      },
      config.jwtSecret,
      {
        algorithm: "HS256",
        subject: session.user.id,
        issuer: "campus-api",
        audience: "campus-web",
        expiresIn: 60,
      },
    );
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + expired)
      .expect(401);
    await agent
      .get("/api/auth/me")
      .set(
        "Authorization",
        "Bearer " + session.accessToken.slice(0, -4) + "xxxx",
      )
      .expect(401);
    await agent.get("/api/auth/me").expect(200);
  });
  it("rota refresh y sesión; permite reintentar la petición original con el nuevo JWT", async () => {
    const response = await agent.post("/api/auth/refresh").send({}).expect(200);
    assert.notEqual(response.body.data.accessToken, session.accessToken);
    assert.notEqual(response.body.data.csrfToken, session.csrfToken);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + session.accessToken)
      .expect(401);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + response.body.data.accessToken)
      .expect(200);
    assert.ok((await RefreshToken.findOne({ usadoEn: { $ne: null } })).usadoEn);
  });
  it("detecta reutilización y revoca toda la familia, incluido el nuevo access token", async () => {
    const response = await agent.post("/api/auth/refresh").send({}).expect(200);
    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refresh)
      .send({})
      .expect(401);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + response.body.data.accessToken)
      .expect(401);
    assert.equal(await Session.countDocuments(), 0);
  });
  it("el cierre de sesión invalida el JWT y el refresh de esa sesión", async () => {
    await agent
      .post("/api/auth/logout")
      .set("Authorization", "Bearer " + session.accessToken)
      .set("X-CSRF-Token", session.csrfToken)
      .send({})
      .expect(200);
    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refresh)
      .send({})
      .expect(401);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + session.accessToken)
      .expect(401);
  });
  it("bloquea refresh tras desactivación o cambio de credenciales", async () => {
    await User.updateOne(
      { _id: session.user.id },
      { $inc: { authVersion: 1 } },
    );
    await agent.post("/api/auth/refresh").send({}).expect(401);
    await agent
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + session.accessToken)
      .expect(401);
  });
  it("rechaza refresh por formulario, origen ajeno o sin Cookie", async () => {
    await agent.post("/api/auth/refresh").type("form").send({}).expect(403);
    await agent
      .post("/api/auth/refresh")
      .set("Origin", "https://ajeno.example")
      .send({})
      .expect(403);
    await request(app).post("/api/auth/refresh").send({}).expect(401);
  });
});
