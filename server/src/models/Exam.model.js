import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    startedAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "EXPIRED"],
      default: "IN_PROGRESS",
    },

    finalCode: {
      type: String,
      default: null,
    },

    language: {
      type: String,
      default: "java",
    },

    codeScore: {
      type: Number,
      default: 0,
    },

    aiScore: {
      type: Number,
      default: 0,
    },

    timeScore: {
      type: Number,
      default: 0,
    },

    finalScore: {
      type: Number,
      default: 0,
    },

    result: {
      type: String,
      enum: ["PASS", "FAIL", null],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);


const Exams = mongoose.model("Exams", examSchema);

export default Exams;