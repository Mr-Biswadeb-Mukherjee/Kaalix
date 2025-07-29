import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import authRouter from "./Modules/auth.js";

dotenv.config();

const app = express();
const PORT = 6000;

app.use(cors());
app.use(bodyParser.json());

app.use("/api/v3/auth", authRouter);

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});
