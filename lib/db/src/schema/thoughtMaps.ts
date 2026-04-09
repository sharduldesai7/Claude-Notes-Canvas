import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const thoughtMapsTable = pgTable("thought_maps", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("anonymous"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertThoughtMapSchema = createInsertSchema(thoughtMapsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertThoughtMap = z.infer<typeof insertThoughtMapSchema>;
export type ThoughtMap = typeof thoughtMapsTable.$inferSelect;

export const nodesTable = pgTable("nodes", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").notNull().references(() => thoughtMapsTable.id, { onDelete: "cascade" }),
  title: text("title"),
  nodeType: text("node_type").notNull().default("note"),  // 'note' | 'ai_chat'
  content: text("content").notNull().default(""),
  chatHistory: text("chat_history"),                      // JSON array for ai_chat nodes
  positionX: real("position_x").notNull().default(100),
  positionY: real("position_y").notNull().default(100),
  width: real("width").notNull().default(280),
  height: real("height").notNull().default(160),
  color: text("color"),
  claudeResponse: text("claude_response"),
  isProcessing: boolean("is_processing").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Node = typeof nodesTable.$inferSelect;

export const connectionsTable = pgTable("connections", {
  id: serial("id").primaryKey(),
  mapId: integer("map_id").notNull().references(() => thoughtMapsTable.id, { onDelete: "cascade" }),
  fromNodeId: integer("from_node_id").notNull().references(() => nodesTable.id, { onDelete: "cascade" }),
  toNodeId: integer("to_node_id").notNull().references(() => nodesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectionSchema = createInsertSchema(connectionsTable).omit({ id: true, createdAt: true });
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connectionsTable.$inferSelect;

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  preferredModel: text("preferred_model").notNull().default("claude-sonnet-4-6"),
  customApiKey: text("custom_api_key"),
  customBaseUrl: text("custom_base_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({ updatedAt: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;
