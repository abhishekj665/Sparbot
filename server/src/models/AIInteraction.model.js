import mongoose from "mongoose";

const aiInteractionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },

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

    userMessage: {
      type: String,
      required: true,
    },

    aiResponse: {
      type: String,
      required: true,
    },

    suggestedCode: {
      type: String,
      default: null,
    },

    interactionType: {
      type: String,
      enum: [
        "CONCEPT",
        "HINT",
        "APPROACH",
        "DEBUG",
        "EXPLANATION",
        "SOLUTION_REQUEST",
        "OTHER",
      ],
    },

    assessmentStage: {
      type: String,
      default: null,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const AIInteraction = mongoose.model("AIInteraction", aiInteractionSchema);

export default AIInteraction;
