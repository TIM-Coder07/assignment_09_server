require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
app.get("/", async (req, res) => {
  const letestCourse = await courseCollection.find().limit(6).toArray();
  res.send(letestCourse);
});

// Get all tutors courses
app.get("/courses", async (req, res) => {
  const courses = await courseCollection.find().toArray();
  res.send(courses);
});

// GET tutors Details
app.get("/courses/:id", async (req, res) => {
  console.log(req.params);

  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await courseCollection.findOne(query);
  console.log(result);
  
  res.send(result);
});

//(POST) Add new course
app.post("/courses", async (req, res) => {
  const newCourse = req.body;
  const result = await courseCollection.insertOne(newCourse);
  res.send(result);
});


// BOOKING ROUTE (POST);

app.post("/book-session/:id", async (req, res) => {
  try {
    const tutorId = req.params.id;
    const bookingsData = req.body;

    const tutor = await courseCollection.findOne({
      _id: new ObjectId(tutorId),
    });

    if (!tutor) {
      return res.status(404).send({
        success: false,
        message: "Tutor Not Found!",
      });
    }

    const currentDate = new Date();
    const sessionDate = new Date(tutor.startDate);
    console.log(currentDate.getTime(), sessionDate.getTime());

    const isAvailable = sessionDate
        ? sessionDate.getTime() >= currentDate.getTime()
        : false;
      if (!isAvailable) {
        return res.status(400).send({
          success: false,
          message:
            "Booking is not available yet for this tutor.",
        });
      }

    if (tutor.availableSeats <= 0) {
      return res.status(400).send({
        success: false,
        message: "No available slot left",
      });
    }

    const newBookings = {
      ...bookingsData,
      tutorId,
      bookingStatus: "Confirmed",
      bookingTime: new Date(),
    };

    const bookingCollection = client
      .db("onlineCourseA9")
      .collection("bookings");

    const bookingResult = await bookingCollection.insertOne(newBookings);

    const updateSeat = tutor.availableSeats - 1;

    await courseCollection.updateOne(
      { _id: new ObjectId(tutorId) },
      {
        $set: {
          availableSeats: updateSeat,
        },
      }
    );

    return res.send({
      success: true,
      message:
        updateSeat === 0
          ? "This session is fully booked. You can’t join at the moment."
          : "Booking successful",
      bookingResult,
      remainingSlots: updateSeat,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Something went wrong",
    });
  }
});



// ---------------- START SERVER ---------------- //
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
