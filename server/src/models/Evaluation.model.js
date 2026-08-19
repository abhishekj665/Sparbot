import mongoose from "mongoose";

const evaluationSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      unique: true,
    },

    codeScore: {
      type: Number,
      default: 0,
    },

    aiScore: {
      type: Number,
      default: 0,
    },

    problemSolvingScore: {
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
      enum: ["PASS", "FAIL"],
    },

    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Evaluation = mongoose.model("Evaluation", evaluationSchema);

export default Evaluation;
