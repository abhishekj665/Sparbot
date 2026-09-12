import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      default: "leetcode",
      index: true,
    },

    datasetSplit: {
      type: String,
      enum: ["train", "test"],
      index: true,
    },

    sourceId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
    },

    taskId: {
      type: String,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      index: true,
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      index: true,
    },

    topics: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      required: true,
    },

    starterCode: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    entryPoint: {
      type: String,
      default: null,
    },

    test: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    inputOutput: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    assessment: {
      enabled: {
        type: Boolean,
        default: true,
      },

      estimatedTimeMinutes: {
        type: Number,
        default: 5,
      },

      allowedLanguages: {
        type: [String],
        default: ["java"],
      },
    },
  },
  {
    timestamps: true,
    collection: "questions",
  },
);

// The model name must match Exam.questionId's ref for populate() to work.
const Questions = mongoose.model("Question", questionSchema);

export default Questions;
