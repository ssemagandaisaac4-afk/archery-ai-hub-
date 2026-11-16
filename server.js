
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.json({
    name: "Archery AI Hub",
    status: "online",
    message: "Welcome to Archery AI Hub!"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Archery AI Hub running on port ${PORT}`);
});
