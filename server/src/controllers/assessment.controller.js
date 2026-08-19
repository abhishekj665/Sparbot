import {
  completeAssessment,
  createAiInteraction,
  createAssessment,
  findAssessment,
  findEvaluation,
} from "../services/assessment.service.js";

const send = (handler) => async (req, res, next) => {
  try {
    const result = await handler(req);
    res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};

export const startAssessment = send((req) =>
  createAssessment(req.user.id, req.body),
);
export const getAssessment = send((req) =>
  findAssessment(req.user.id, req.params.id),
);
export const askAssistant = send((req) =>
  createAiInteraction(req.user.id, req.params.id, req.body),
);
export const submitAssessment = send((req) =>
  completeAssessment(req.user.id, req.params.id, req.body),
);
export const getEvaluation = send((req) =>
  findEvaluation(req.user.id, req.params.id),
);
