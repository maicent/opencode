import { app } from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const OFFLINE = import.meta.env.OPENCODE_OFFLINE === true

export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev" && !OFFLINE
