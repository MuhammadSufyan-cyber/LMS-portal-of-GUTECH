import { env } from '../config/env.js';
import { getServiceSupabase } from '../config/supabase.js';

if (env.NODE_ENV !== 'development') {
  throw new Error('seed:demo only runs when NODE_ENV=development.');
}

const db = getServiceSupabase();
const demoPassword = 'DemoCampus123!';
const demoStudents = Array.from({ length: 6 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    email: `demo.student${number}@gutech.edu`,
    fullName: [
      'Ayesha Khan',
      'Hamza Ali',
      'Mariam Shah',
      'Zain Ahmed',
      'Noor Fatima',
      'Daniyal Raza',
    ][index]!,
    username: `demo.student${number}`,
    rollNo: `GT-DEMO-${number}`,
    role: 'student' as const,
  };
});
const demoTeacher = {
  email: 'demo.teacher@gutech.edu',
  fullName: 'Demo Instructor',
  username: 'demo.teacher',
  role: 'teacher' as const,
};
const courseSeeds = [
  {
    code: 'AIT201',
    title: 'Data Structures',
    description: 'Algorithms, data structures, and problem solving.',
  },
  {
    code: 'SE220',
    title: 'Software Engineering',
    description: 'Requirements, design, testing, and teamwork.',
  },
  {
    code: 'DS310',
    title: 'Data Analytics',
    description: 'Practical data exploration and visualization.',
  },
];

async function ensureAccount(
  account: typeof demoTeacher | (typeof demoStudents)[number],
  rollNo: string | null,
) {
  const email = account.email.trim().toLowerCase();
  const { data: profile, error: profileLookupError } = await db
    .from('profiles')
    .select('id,email')
    .eq('email', email)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;

  const { data: listed, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const matchingUsers = listed.users.filter((user) => user.email?.trim().toLowerCase() === email);
  if (matchingUsers.length > 1) throw new Error(`Duplicate Auth users found for ${email}.`);
  let user = profile
    ? (await db.auth.admin.getUserById(profile.id)).data.user
    : (matchingUsers[0] ?? null);

  if (user) {
    const { data, error } = await db.auth.admin.updateUserById(user.id, {
      email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        full_name: account.fullName,
        username: account.username,
      },
    });
    if (error || !data.user) throw error ?? new Error(`Could not update ${email}.`);
    user = data.user;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, username: account.username },
    });
    if (error || !data.user) throw error ?? new Error(`Could not create ${email}.`);
    user = data.user;
  }

  const { error } = await db.from('profiles').upsert(
    {
      id: user.id,
      full_name: account.fullName,
      username: account.username,
      email,
      role: account.role,
      roll_no: rollNo,
      is_active: true,
      must_change_password: false,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
  return user.id;
}

async function seedDemoData() {
  const [teacherId, ...studentIds] = await Promise.all([
    ensureAccount(demoTeacher, null),
    ...demoStudents.map((student) => ensureAccount(student, student.rollNo)),
  ]);
  if (!teacherId) throw new Error('Demo teacher account could not be provisioned.');

  const { error: courseError } = await db
    .from('courses')
    .upsert(courseSeeds, { onConflict: 'code' });
  if (courseError) throw courseError;
  const courseCodes = courseSeeds.map((course) => course.code);
  const { data: courses, error: coursesError } = await db
    .from('courses')
    .select('id,code')
    .in('code', courseCodes);
  if (coursesError) throw coursesError;
  if ((courses ?? []).length !== courseSeeds.length)
    throw new Error('Could not load all demo courses.');

  const memberships = courses!.flatMap((course) => [
    { course_id: course.id, teacher_id: teacherId },
  ]);
  const { error: teacherError } = await db
    .from('course_teachers')
    .upsert(memberships, { onConflict: 'course_id,teacher_id', ignoreDuplicates: true });
  if (teacherError) throw teacherError;

  const checker = await db
    .from('profiles')
    .select('id')
    .eq('email', 'gutechchecker@gmail.com')
    .maybeSingle();
  if (checker.error) throw checker.error;
  const studentIdsToEnroll = [...studentIds, ...(checker.data ? [checker.data.id] : [])];
  const enrollments = courses!.flatMap((course) =>
    studentIdsToEnroll.map((studentId) => ({ course_id: course.id, student_id: studentId })),
  );
  const { error: enrollmentError } = await db
    .from('enrollments')
    .upsert(enrollments, { onConflict: 'course_id,student_id', ignoreDuplicates: true });
  if (enrollmentError) throw enrollmentError;

  const assignments = courses!.flatMap((course, courseIndex) => [
    {
      id: `30000000-0000-4000-8000-${String(courseIndex * 2 + 1).padStart(12, '0')}`,
      course_id: course.id,
      created_by: teacherId,
      title: `${course.code} Coursework`,
      instructions: 'Sample graded work for the development environment.',
      max_marks: 100,
      due_at: '2026-10-01T12:00:00.000Z',
      allow_late: true,
    },
    {
      id: `30000000-0000-4000-8000-${String(courseIndex * 2 + 2).padStart(12, '0')}`,
      course_id: course.id,
      created_by: teacherId,
      title: `${course.code} Quiz 1`,
      instructions: 'Sample quiz grade for the development environment.',
      max_marks: 20,
      due_at: '2026-10-08T12:00:00.000Z',
      allow_late: true,
    },
  ]);
  const { error: assignmentError } = await db
    .from('assignments')
    .upsert(assignments, { onConflict: 'id' });
  if (assignmentError) throw assignmentError;

  const submissions = assignments.flatMap((assignment, assignmentIndex) =>
    studentIdsToEnroll.map((studentId, studentIndex) => ({
      assignment_id: assignment.id,
      student_id: studentId,
      text_answer: 'Sample work submitted for the development demo.',
      submitted_at: '2026-10-10T10:00:00.000Z',
      is_late: false,
      marks_obtained:
        assignmentIndex % 2 === 0
          ? 72 + ((studentIndex * 7 + assignmentIndex * 3) % 27)
          : 14 + ((studentIndex * 3 + assignmentIndex) % 7),
      feedback: 'Good work. Keep building on this progress.',
      graded_by: teacherId,
      graded_at: '2026-10-12T10:00:00.000Z',
    })),
  );
  const { error: submissionError } = await db
    .from('submissions')
    .upsert(submissions, { onConflict: 'assignment_id,student_id' });
  if (submissionError) throw submissionError;

  const demoClassDays = ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28'];
  const attendancePattern = [
    'present',
    'present',
    'late',
    'present',
    'absent',
    'present',
    'excused',
  ];
  const attendance = courses!.flatMap((course, courseIndex) =>
    studentIdsToEnroll.flatMap((studentId, studentIndex) =>
      demoClassDays.map((classDate, dayIndex) => ({
        course_id: course.id,
        student_id: studentId,
        class_date: classDate,
        status:
          attendancePattern[(studentIndex + courseIndex + dayIndex) % attendancePattern.length],
        notes: 'seed:demo',
        marked_by: teacherId,
      })),
    ),
  );
  const { error: attendanceError } = await db
    .from('attendance_records')
    .upsert(attendance, { onConflict: 'course_id,student_id,class_date' });
  const attendanceUnavailable =
    attendanceError && ['PGRST205', '42P01'].includes(attendanceError.code);
  if (attendanceError && !attendanceUnavailable) throw attendanceError;

  console.log(
    `Seeded ${demoStudents.length} demo students, ${courseSeeds.length} courses, ${assignments.length} assignments, and ${submissions.length} grades.`,
  );
  if (attendanceUnavailable) {
    console.warn(
      'Attendance was skipped because attendance_records is not installed in this database. Set a valid SUPABASE_DB_URL, run npm run db:apply-attendance, then rerun npm run seed:demo.',
    );
  } else {
    console.log(`Seeded ${attendance.length} attendance records.`);
  }
  console.log(`Demo student password: ${demoPassword}`);
}

seedDemoData().catch((error: unknown) => {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'Demo data seeding failed.';
  console.error(detail);
  process.exitCode = 1;
});
