import express from "express";
import cors from "cors";

const PORT = process.env.PORT || 5000;
const app = express();

const { default: users } = await import("./routes/users.js");

app.use(cors());
app.use(express.json());
app.use("/record", users);

// start the Express server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
