import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    server: { port: 5173, host: true },
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
