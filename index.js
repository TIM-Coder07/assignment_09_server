require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGO_DB_URI;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ---------------- COLLECTIONS ---------------- //
let courseCollection;
let myTutorsCollection;
let bookingCollection;

// ---------------- CONNECT DB ---------------- //
async function run() {
  try {
    await client.connect();

    const db = client.db("onlineCourseA9");

    courseCollection = db.collection("courses");
    myTutorsCollection = db.collection("my-tutors");
    bookingCollection = db.collection("bookings");

    console.log("🚀 MongoDB Connected Successfully!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run();

// ---------------- ROUTES ---------------- //

// Home route (latest 6 courses)
app.get("/", async (req, res) => {
  try {
    const latestCourse = await courseCollection.find().limit(6).toArray();
    res.send(latestCourse);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Get all courses
app.get("/courses", async (req, res) => {
  try {
    const courses = await courseCollection.find().toArray();
    res.send(courses);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Get course details
app.get("/courses/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const course = await courseCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(course);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Add new course
app.post("/courses", async (req, res) => {
  try {
    const newCourse = req.body;

    const result = await courseCollection.insertOne(newCourse);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ---------------- BOOK SESSION ---------------- //
app.post("/book-session/:id", async (req, res) => {
  try {
    const tutorId = req.params.id;
    const bookingData = req.body;

    const tutor = await courseCollection.findOne({
      _id: new ObjectId(tutorId),
    });

    if (!tutor) {
      return res.status(404).send({
        success: false,
        message: "Tutor not found",
      });
    }

    // Date validation
    const currentDate = new Date();
    const sessionDate = new Date(tutor.startDate);

    const isAvailable =
      sessionDate && sessionDate.getTime() >= currentDate.getTime();

    if (!isAvailable) {
      return res.status(400).send({
        success: false,
        message: "Booking not available yet",
      });
    }

    // Seat check
    if (tutor.availableSeats <= 0) {
      return res.status(400).send({
        success: false,
        message: "No available seats",
      });
    }

    // Create booking object
    const newBooking = {
      ...bookingData,
      tutorId,
      bookingStatus: "Confirmed",
      bookingTime: new Date(),
    };

    // Insert booking
    const bookingResult = await bookingCollection.insertOne(newBooking);

    // Update seats
    const updatedSeats = tutor.availableSeats - 1;

    await courseCollection.updateOne(
      { _id: new ObjectId(tutorId) },
      {
        $set: { availableSeats: updatedSeats },
      }
    );

    res.send({
      success: true,
      message:
        updatedSeats === 0
          ? "Fully booked"
          : "Booking successful",
      bookingResult,
      remainingSeats: updatedSeats,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// ---------------- MY TUTORS ---------------- //

// GET :
app.get("/my-tutors/:email", async (req, res) => {
  try {
    const creatorEmail = req.params.email;

    const result = await courseCollection
      .find({ creatorEmail })
      .toArray();
      console.log('Result', result);
      

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

//DELETE
app.delete("/tutors/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await courseCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Tutor not found",
      });
    }

    res.send({
      success: true,
      message: "Tutor deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ------------------------------ MY BOOK SESSION ---------------- //

// GET 
app.get('/my-bookings/:email', async (req, res) => {

    const email = req.params.email;

    const query = {
        studentEmail: email
    };

    const result = await bookingCollection.find(query).toArray();

    res.send(result);
});

//DELETE
app.delete("/my-bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await courseCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Tutor not found",
      });
    }

    res.send({
      success: true,
      message: "Tutor deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});






// ---------------- SERVER START ---------------- //
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

{/* <button
                  onClick={() => authClient.signOut()}
                  className="py-2 rounded-full bg-red-500 text-white"
                >
                  Logout
                </button> */}