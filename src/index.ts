import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.routes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
app.use(express.json());

app.use("/health", healthRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "SurveyStat backend API is running",
  });
});

app.listen(port, () => {
  console.log(`SurveyStat backend API running on port ${port}`);
});
