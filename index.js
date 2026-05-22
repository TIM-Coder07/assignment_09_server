require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet,jwtVerify } = require("jose-cjs");

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

// Verify  
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT ERROR:", err);

    return res.status(403).json({
      message: "Forbidden",
    });
  }
};

// ---------------- COLLECTIONS ---------------- //
let courseCollection;
let myTutorsCollection;
let bookingCollection;

// ---------------- CONNECT DB ---------------- //
async function run() {
  try {
    // await client.connect();

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

// Get all tutos page courses
app.get("/courses", async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    console.log("startDate", startDate);
    

    const query = {};

    // ---------------- SEARCH ----------------
    if (search?.trim()) {
      query.courseTitle = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // ---------------- DATE FILTER ----------------
    if (startDate) {
      query.startDate = {};

      if (startDate) {
        query.startDate.$gte = startDate;
      }
    }
    // endDate
    if (endDate) {
      query.startDate = {};

      if (endDate) {
        query.startDate.$gte = endDate;
      }
    }
    console.log('query', query);
    
    const courses = await courseCollection.find(query).toArray();

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

// Add new course TUTOR PAGE
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

    if (!ObjectId.isValid(tutorId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid tutor id",
      });
    }

    const tutor = await courseCollection.findOne({
      _id: new ObjectId(tutorId),
    });

    if (!tutor) {
      return res.status(404).send({
        success: false,
        message: "Tutor not found",
      });
    }

    // duplicate check
    const alreadyBooked = await bookingCollection.findOne({
      tutorId,
      studentEmail: bookingData.studentEmail,
    });

    if (alreadyBooked) {
      return res.status(400).send({
        success: false,
        message: "Already booked this session",
      });
    }

    // seat check + atomic update
    const seatUpdate = await courseCollection.updateOne(
      {
        _id: new ObjectId(tutorId),
        availableSeats: { $gt: 0 },
      },
      {
        $inc: { availableSeats: -1 },
      }
    );

    if (seatUpdate.modifiedCount === 0) {
      return res.status(400).send({
        success: false,
        message: "No available seats",
      });
    }

    const newBooking = {
      ...bookingData,
      tutorId,
      status: "confirmed",
      bookingTime: new Date(),
    };

    const result = await bookingCollection.insertOne(newBooking);

    res.send({
      success: true,
      message: "Booking successful",
      bookingId: result.insertedId,
    });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// ---------------- MY TUTORS ---------------- //
// middelware
// GET :
app.get(
  "/my-tutors/:email", verifyToken, async (req, res) => {
    try {
      const creatorEmail = req.params.email;
      console.log("creatorEmail", creatorEmail);
      

      const result = await courseCollection.find({ creatorEmail }).toArray();
      console.log("Result", result);

      res.json(result);
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  },
);

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

// GET(send user book data)
app.get("/my-bookings/email/:email", async (req, res) => {
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const result = await bookingCollection
      .find({ studentEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

//CANCEL USING PATCH
app.patch("/my-bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const filter = { _id: new ObjectId(id) };

    const updateDoc = {
      $set: { status: "cancelled" },
    };

    const result = await bookingCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    res.send({
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// ---------------- SERVER START ---------------- //
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
