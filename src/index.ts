import express from "express";
import healthRoutes from "./routes/health.routes.js";
import { configureMiddleware } from "./middleware/middleware.js";
import { env, getServerAppUrl } from "./lib/env.js";

const app = express();
const port = env.port;

configureMiddleware(app);

app.use("/health", healthRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "SurveyStat backend API is running",
    url: getServerAppUrl(),
  });
});

app.listen(port, () => {
  console.log(`SurveyStat backend API running on port ${port}`);
  console.log(`Server app URL: ${getServerAppUrl()}`);
});
