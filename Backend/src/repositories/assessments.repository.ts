import { getServiceSupabase } from '../config/supabase.js';
import { HttpError } from '../utils/http-error.js';

export async function listAssignments(courseId: string) {
  const { data, error } = await getServiceSupabase()
    .from('assignments')
    .select('*')
    .eq('course_id', courseId)
    .order('due_at');
  if (error) throw error;
  return data ?? [];
}
export async function createAssignment(
  courseId: string,
  actorId: string,
  input: Record<string, unknown>,
) {
  const { data, error } = await getServiceSupabase()
    .from('assignments')
    .insert({
      course_id: courseId,
      created_by: actorId,
      title: input.title,
      instructions: input.instructions,
      max_marks: input.maxMarks,
      due_at: input.dueAt,
      allow_late: input.allowLate,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
export async function findAssignment(id: string) {
  const { data, error } = await getServiceSupabase()
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found.');
  return data;
}
export async function mySubmission(assignmentId: string, studentId: string) {
  const { data, error } = await getServiceSupabase()
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function findSubmission(id: string) {
  const { data, error } = await getServiceSupabase()
    .from('submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
  return data;
}
export async function saveSubmission(
  assignmentId: string,
  studentId: string,
  textAnswer: string,
  isLate: boolean,
  filePath?: string | null,
) {
  const { data, error } = await getServiceSupabase()
    .from('submissions')
    .upsert(
      {
        assignment_id: assignmentId,
        student_id: studentId,
        text_answer: textAnswer,
        file_path: filePath ?? null,
        is_late: isLate,
        submitted_at: new Date().toISOString(),
        marks_obtained: null,
        feedback: null,
        graded_by: null,
        graded_at: null,
      },
      { onConflict: 'assignment_id,student_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
export async function listSubmissions(assignmentId: string, page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await getServiceSupabase()
    .from('submissions')
    .select('*,profile:profiles!submissions_student_id_fkey(full_name,email,roll_no)', {
      count: 'exact',
    })
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
}
export async function gradeSubmission(
  id: string,
  graderId: string,
  marks: number,
  feedback?: string,
) {
  const { data: submission, error: findError } = await getServiceSupabase()
    .from('submissions')
    .select('id,assignment_id,assignment:assignments!inner(max_marks)')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  if (!submission) throw new HttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found.');
  const assignment = submission.assignment as unknown as { max_marks: number };
  if (marks > Number(assignment.max_marks))
    throw new HttpError(422, 'MARKS_EXCEED_MAX', 'Marks cannot exceed the assignment maximum.');
  const { data, error } = await getServiceSupabase()
    .from('submissions')
    .update({
      marks_obtained: marks,
      feedback: feedback ?? null,
      graded_by: graderId,
      graded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listQuizzes(courseId: string, student: boolean) {
  let query = getServiceSupabase()
    .from('quizzes')
    .select('*')
    .eq('course_id', courseId)
    .order('opens_at');
  if (student) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) throw error;
  const quizzes = data ?? [];
  if (!quizzes.length) return [];
  const { data: questions, error: questionsError } = await getServiceSupabase()
    .from('quiz_questions')
    .select('id,quiz_id,position,type,prompt,options,marks')
    .in(
      'quiz_id',
      quizzes.map((quiz) => quiz.id),
    )
    .order('position');
  if (questionsError) throw questionsError;
  return quizzes.map((quiz) => ({
    ...quiz,
    questions: (questions ?? []).filter((question) => question.quiz_id === quiz.id),
  }));
}

export async function createQuiz(
  courseId: string,
  actorId: string,
  input: {
    title: string;
    description?: string;
    timeLimitMinutes: number;
    opensAt: string;
    closesAt: string;
    questions: Array<{
      type: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
      correctOptionIds: string[];
      marks: number;
    }>;
  },
) {
  const db = getServiceSupabase();
  const { data: quiz, error } = await db
    .from('quizzes')
    .insert({
      course_id: courseId,
      created_by: actorId,
      title: input.title,
      description: input.description ?? null,
      time_limit_minutes: input.timeLimitMinutes,
      opens_at: input.opensAt,
      closes_at: input.closesAt,
      is_published: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  const questionRows = input.questions.map((question, index) => ({
    quiz_id: quiz.id,
    position: index + 1,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    marks: question.marks,
  }));
  const { data: questions, error: questionError } = await db
    .from('quiz_questions')
    .insert(questionRows)
    .select('id,position');
  if (questionError || !questions) {
    await db.from('quizzes').delete().eq('id', quiz.id);
    throw questionError ?? new Error('Quiz questions were not created.');
  }
  const answers = questions.map((question) => ({
    question_id: question.id,
    correct_option_ids: input.questions[question.position - 1]?.correctOptionIds ?? [],
  }));
  const { error: answerError } = await db.from('quiz_answers').insert(answers);
  if (answerError) {
    await db.from('quizzes').delete().eq('id', quiz.id);
    throw answerError;
  }
  return {
    ...quiz,
    questions: (questions ?? []).map((question, index) => ({
      ...question,
      ...questionRows[index],
      quiz_id: quiz.id,
    })),
  };
}

export async function submitQuiz(
  quizId: string,
  studentId: string,
  answers: Record<string, string[]>,
) {
  const db = getServiceSupabase();
  const { data: existing, error: existingError } = await db
    .from('quiz_attempts')
    .select('id')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new HttpError(409, 'QUIZ_NOT_STARTED', 'Start the quiz before submitting.');
  const { data: attempt, error: attemptError } = await db
    .from('quiz_attempts')
    .select('id,started_at,submitted_at')
    .eq('id', existing.id)
    .single();
  if (attemptError) throw attemptError;
  if (attempt.submitted_at)
    throw new HttpError(409, 'QUIZ_ALREADY_ATTEMPTED', 'This quiz has already been submitted.');
  const { data: questions, error } = await db
    .from('quiz_questions')
    .select('id,marks,answer:quiz_answers!inner(correct_option_ids)')
    .eq('quiz_id', quizId);
  if (error) throw error;
  const score = (questions ?? []).reduce((total, question) => {
    const answer = question.answer as unknown as { correct_option_ids: string[] };
    const expected = [...answer.correct_option_ids].sort();
    const actual = [...(answers[question.id] ?? [])].sort();
    return (
      total +
      (expected.length === actual.length &&
      expected.every((value, index) => value === actual[index])
        ? Number(question.marks)
        : 0)
    );
  }, 0);
  const { data: result, error: submitError } = await db
    .from('quiz_attempts')
    .update({
      answers,
      submitted_at: new Date().toISOString(),
      score,
    })
    .eq('id', attempt.id)
    .is('submitted_at', null)
    .select('id,quiz_id,student_id,started_at,submitted_at,score')
    .maybeSingle();
  if (submitError) throw submitError;
  if (!result)
    throw new HttpError(409, 'QUIZ_ALREADY_ATTEMPTED', 'This quiz has already been submitted.');
  return result;
}

export async function startQuiz(quizId: string, studentId: string) {
  const { data, error } = await getServiceSupabase()
    .from('quiz_attempts')
    .insert({ quiz_id: quizId, student_id: studentId })
    .select('id,quiz_id,started_at,submitted_at')
    .single();
  if (error?.code === '23505')
    throw new HttpError(409, 'QUIZ_ALREADY_ATTEMPTED', 'This quiz has already been attempted.');
  if (error) throw error;
  return data;
}

export async function getAttempt(quizId: string, studentId: string) {
  const { data, error } = await getServiceSupabase()
    .from('quiz_attempts')
    .select('id,quiz_id,student_id,started_at,submitted_at,score')
    .eq('quiz_id', quizId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
