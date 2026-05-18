require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 8000;
const uri = process.env.MONGO_DB_URI;

app.use(cors());
app.use(express.json());

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// DB + Collection
let courseCollection;

async function run() {
  try {
    await client.connect();

    const db = client.db("onlineCourseA9");
    courseCollection = db.collection("courses");

    console.log(" Connected to MongoDB successfully!");
  } catch (error) {
    console.error(" MongoDB connection error:", error);
  }
}

run();

// ---------------- ROUTES ----------------- //

// Home route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// Get all courses
app.get("/courses", async (req, res) => {
  const courses = await courseCollection.find().toArray();
  res.send(courses);
});

//(POST) Add new course
app.post("/courses", async (req, res) => {
  const newCourse = req.body;
  const result = await courseCollection.insertOne(newCourse);
  res.send(result);
});

// ---------------- START SERVER ---------------- //
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});