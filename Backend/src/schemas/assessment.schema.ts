import { z } from 'zod';
import { paginationSchema, uuidSchema } from './courses.schema.js';

export const assignmentCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  instructions: z.string().trim().min(1).max(12000),
  maxMarks: z.number().positive().max(99999),
  dueAt: z.iso.datetime(),
  allowLate: z.boolean().default(false),
});
export const submissionSchema = z.object({
  textAnswer: z.string().trim().max(12000).optional(),
});
export const gradeSchema = z.object({
  marks: z.number().min(0).max(99999),
  feedback: z.string().trim().max(4000).optional(),
});
export const assignmentQuerySchema = paginationSchema;
export const assignmentIdSchema = uuidSchema;
const optionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(300),
});
const questionSchema = z
  .object({
    type: z.enum(['mcq_single', 'mcq_multi', 'true_false']),
    prompt: z.string().trim().min(2).max(2000),
    options: z.array(optionSchema).min(2).max(8),
    correctOptionIds: z.array(z.string().min(1)).min(1).max(8),
    marks: z.number().positive().max(999),
  })
  .refine(
    (question) =>
      question.correctOptionIds.every((id) => question.options.some((option) => option.id === id)),
    'Correct options must match this question.',
  )
  .refine(
    (question) =>
      new Set(question.options.map((option) => option.id)).size === question.options.length,
    'Option IDs must be unique.',
  )
  .refine(
    (question) => new Set(question.correctOptionIds).size === question.correctOptionIds.length,
    'Correct options must be unique.',
  )
  .refine(
    (question) => question.type === 'mcq_multi' || question.correctOptionIds.length === 1,
    'Choose one correct option for this question.',
  );
export const quizCreateSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).optional(),
    timeLimitMinutes: z.number().int().min(1).max(360),
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .refine(
    (quiz) => new Date(quiz.closesAt) > new Date(quiz.opensAt),
    'Quiz close time must be after its open time.',
  );
export const quizAnswersSchema = z.object({
  answers: z.record(z.string(), z.array(z.string().min(1)).max(8)),
});
